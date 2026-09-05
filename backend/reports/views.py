import csv
import io
from datetime import datetime
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import ExtractMonth
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework.response import Response
from rest_framework.views import APIView

from transactions.models import Transaction


class MonthlyReportView(APIView):
    def get(self, request):
        year = request.query_params.get('year')
        queryset = Transaction.objects.filter(user=request.user)
        if year:
            queryset = queryset.filter(date__year=year)
        rows = queryset.annotate(month=ExtractMonth('date')).values('month', 'type').annotate(total=Sum('amount')).order_by('month', 'type')
        return Response(rows)


class CategoryReportView(APIView):
    def get(self, request):
        queryset = Transaction.objects.filter(user=request.user)
        if request.query_params.get('year'):
            queryset = queryset.filter(date__year=request.query_params['year'])
        if request.query_params.get('month'):
            queryset = queryset.filter(date__month=request.query_params['month'])
        rows = queryset.values('category__id', 'category__name', 'type').annotate(total=Sum('amount')).order_by('type', '-total')
        return Response(rows)


class MonthlyReportExportView(APIView):
    def get(self, request):
        now = datetime.now()
        year = int(request.query_params.get('year', now.year))
        month = int(request.query_params.get('month', now.month))
        currency_code = request.query_params.get('currency', 'USD').upper()
        symbol = 'Rs.' if 'RUP' in currency_code or 'RS' in currency_code or 'LKR' in currency_code or 'INR' in currency_code else '$'

        month_name = datetime(year, month, 1).strftime('%B %Y')
        transactions = Transaction.objects.filter(
            user=request.user,
            date__year=year,
            date__month=month,
        ).select_related('category').order_by('date', 'id')

        total_income = transactions.filter(type='income').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        total_expense = transactions.filter(type='expense').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        net_balance = total_income - total_expense

        category_summary = (
            transactions.values('category__name', 'type')
            .annotate(total=Sum('amount'))
            .order_by('type', '-total')
        )

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="monthly_report_{year}_{month:02d}.csv"'

        writer = csv.writer(response)

        # 1. Statement Header
        writer.writerow(['EXPENSE TRACKER - MONTHLY FINANCIAL STATEMENT'])
        writer.writerow(['User', request.user.username])
        writer.writerow(['Period', month_name])
        writer.writerow(['Currency', f'Rupees ({symbol})' if symbol == 'Rs.' else f'USD ({symbol})'])
        writer.writerow(['Generated On', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow([])

        # 2. Executive Summary
        writer.writerow(['FINANCIAL SUMMARY'])
        writer.writerow([f'Total Income ({symbol})', f'{total_income:.2f}'])
        writer.writerow([f'Total Expenses ({symbol})', f'{total_expense:.2f}'])
        writer.writerow([f'Net Savings / Balance ({symbol})', f'{net_balance:.2f}'])
        writer.writerow([])

        # 3. Category Breakdown
        writer.writerow(['CATEGORY BREAKDOWN'])
        writer.writerow(['Category', 'Type', f'Total Amount ({symbol})'])
        if category_summary.exists():
            for item in category_summary:
                writer.writerow([item['category__name'], item['type'].capitalize(), f"{item['total']:.2f}"])
        else:
            writer.writerow(['No category data for this month', '-', '0.00'])
        writer.writerow([])

        # 4. Itemized Transaction Ledger
        writer.writerow(['DETAILED TRANSACTIONS'])
        writer.writerow(['Date', 'Type', 'Category', 'Description', f'Amount ({symbol})'])
        if transactions.exists():
            for tx in transactions:
                writer.writerow([
                    tx.date.strftime('%Y-%m-%d'),
                    tx.type.capitalize(),
                    tx.category.name if tx.category else 'Uncategorized',
                    tx.description or '-',
                    f'{tx.amount:.2f}',
                ])
        else:
            writer.writerow(['No transactions recorded for this month', '-', '-', '-', '0.00'])

        return response


class MonthlyReportPDFExportView(APIView):
    def get(self, request):
        now = datetime.now()
        year = int(request.query_params.get('year', now.year))
        month = int(request.query_params.get('month', now.month))
        currency_code = request.query_params.get('currency', 'USD').upper()
        symbol = 'Rs.' if 'RUP' in currency_code or 'RS' in currency_code or 'LKR' in currency_code or 'INR' in currency_code else '$'

        month_name = datetime(year, month, 1).strftime('%B %Y')
        transactions = Transaction.objects.filter(
            user=request.user,
            date__year=year,
            date__month=month,
        ).select_related('category').order_by('date', 'id')

        total_income = transactions.filter(type='income').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        total_expense = transactions.filter(type='expense').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        net_balance = total_income - total_expense

        category_summary = (
            transactions.values('category__name', 'type')
            .annotate(total=Sum('amount'))
            .order_by('type', '-total')
        )

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Heading1'],
            fontSize=20,
            leading=24,
            textColor=colors.HexColor('#1f7a70'),
            fontName='Helvetica-Bold',
        )
        subtitle_style = ParagraphStyle(
            'DocSubTitle',
            parent=styles['Normal'],
            fontSize=10,
            leading=13,
            textColor=colors.HexColor('#64748b'),
        )
        heading_style = ParagraphStyle(
            'SectionHeading',
            parent=styles['Heading2'],
            fontSize=13,
            leading=16,
            textColor=colors.HexColor('#1e293b'),
            fontName='Helvetica-Bold',
            spaceBefore=12,
            spaceAfter=6,
        )
        body_style = ParagraphStyle(
            'TableBody',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#334155'),
        )
        bold_body = ParagraphStyle(
            'BoldTableBody',
            parent=body_style,
            fontName='Helvetica-Bold',
        )

        story = []

        # 1. Header Banner with Logo
        import os
        logo_path = os.path.join(os.path.dirname(__file__), 'assets', 'logo.png')
        if os.path.exists(logo_path):
            from reportlab.platypus import Image as RLImage
            logo_img = RLImage(logo_path, width=48, height=48)
            header_text = [
                Paragraph('SPENDWISE - MONTHLY STATEMENT', title_style),
                Spacer(1, 2),
                Paragraph(f'Prepared for: <b>{request.user.username}</b> &nbsp;|&nbsp; Period: <b>{month_name}</b> &nbsp;|&nbsp; Currency: <b>{currency_code} ({symbol})</b> &nbsp;|&nbsp; Generated: {now.strftime("%Y-%m-%d %H:%M")}', subtitle_style),
            ]
            header_table = Table([[logo_img, header_text]], colWidths=[58, 482])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))
            story.append(header_table)
        else:
            story.append(Paragraph('SPENDWISE - MONTHLY FINANCIAL STATEMENT', title_style))
            story.append(Spacer(1, 4))
            story.append(Paragraph(f'Prepared for: <b>{request.user.username}</b> &nbsp;|&nbsp; Period: <b>{month_name}</b> &nbsp;|&nbsp; Currency: <b>{currency_code} ({symbol})</b> &nbsp;|&nbsp; Generated: {now.strftime("%Y-%m-%d %H:%M")}', subtitle_style))

        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1f7a70'), spaceAfter=14))

        # 2. Financial Summary
        story.append(Paragraph('Executive Summary', heading_style))
        summary_data = [
            [
                Paragraph('<b>Total Income</b>', bold_body),
                Paragraph('<b>Total Expenses</b>', bold_body),
                Paragraph('<b>Net Savings / Balance</b>', bold_body),
            ],
            [
                Paragraph(f'<font color="#16a34a" size="12"><b>{symbol} {total_income:,.2f}</b></font>', body_style),
                Paragraph(f'<font color="#dc2626" size="12"><b>{symbol} {total_expense:,.2f}</b></font>', body_style),
                Paragraph(f'<font color="{"#16a34a" if net_balance >= 0 else "#dc2626"}" size="12"><b>{symbol} {net_balance:,.2f}</b></font>', body_style),
            ],
        ]
        summary_table = Table(summary_data, colWidths=[180, 180, 180])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 14))

        # 3. Category Breakdown
        story.append(Paragraph('Spending & Income by Category', heading_style))
        cat_data = [[
            Paragraph('<b>Category</b>', bold_body),
            Paragraph('<b>Type</b>', bold_body),
            Paragraph(f'<b>Total ({symbol})</b>', bold_body),
        ]]
        if category_summary.exists():
            for item in category_summary:
                cat_data.append([
                    Paragraph(item['category__name'] or 'Uncategorized', body_style),
                    Paragraph(f'<font color="{"#16a34a" if item["type"] == "income" else "#dc2626"}">{item["type"].capitalize()}</font>', body_style),
                    Paragraph(f"{symbol} {item['total']:,.2f}", body_style),
                ])
        else:
            cat_data.append([
                Paragraph('No category activity recorded for this period', body_style),
                Paragraph('-', body_style),
                Paragraph(f'{symbol} 0.00', body_style),
            ])

        cat_table = Table(cat_data, colWidths=[240, 150, 150])
        cat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1f7a70')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        # Style table header text to white
        for i in range(len(cat_data[0])):
            cat_data[0][i] = Paragraph(f'<font color="white"><b>{cat_data[0][i].text.replace("<b>", "").replace("</b>", "")}</b></font>', body_style)

        story.append(cat_table)
        story.append(Spacer(1, 14))

        # 4. Itemized Transaction Ledger
        story.append(Paragraph('Itemized Transactions', heading_style))
        tx_data = [[
            Paragraph('<font color="white"><b>Date</b></font>', body_style),
            Paragraph('<font color="white"><b>Type</b></font>', body_style),
            Paragraph('<font color="white"><b>Category</b></font>', body_style),
            Paragraph('<font color="white"><b>Description</b></font>', body_style),
            Paragraph(f'<font color="white"><b>Amount ({symbol})</b></font>', body_style),
        ]]
        if transactions.exists():
            for tx in transactions:
                tx_data.append([
                    Paragraph(tx.date.strftime('%Y-%m-%d'), body_style),
                    Paragraph(f'<font color="{"#16a34a" if tx.type == "income" else "#dc2626"}">{tx.type.capitalize()}</font>', body_style),
                    Paragraph(tx.category.name if tx.category else 'Uncategorized', body_style),
                    Paragraph(tx.description or '-', body_style),
                    Paragraph(f'<b>{"+" if tx.type == "income" else "-"}{symbol} {tx.amount:,.2f}</b>', body_style),
                ])
        else:
            tx_data.append([
                Paragraph('No transactions found', body_style),
                Paragraph('-', body_style),
                Paragraph('-', body_style),
                Paragraph('-', body_style),
                Paragraph(f'{symbol} 0.00', body_style),
            ])

        tx_table = Table(tx_data, colWidths=[75, 65, 110, 180, 110])
        tx_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1f7a70')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(tx_table)

        story.append(Spacer(1, 16))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceAfter=8))
        story.append(Paragraph('<font size="8" color="#94a3b8">Spendwise Expense Tracker &copy; Confidential Financial Statement</font>', subtitle_style))

        doc.build(story)
        pdf = buffer.getvalue()
        buffer.close()

        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="monthly_report_{year}_{month:02d}_{currency_code}.pdf"'
        response.write(pdf)
        return response

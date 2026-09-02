from django.db.models import Sum
from django.db.models.functions import ExtractMonth
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

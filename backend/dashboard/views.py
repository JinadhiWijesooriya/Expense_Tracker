from django.db.models import Sum
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from budgets.models import Budget
from transactions.models import Transaction


class DashboardView(APIView):
    def get(self, request):
        today = timezone.localdate()
        transactions = Transaction.objects.filter(user=request.user)
        income = transactions.filter(type='income').aggregate(total=Sum('amount'))['total'] or 0
        expenses = transactions.filter(type='expense').aggregate(total=Sum('amount'))['total'] or 0
        monthly_expenses = transactions.filter(type='expense', date__year=today.year, date__month=today.month).aggregate(total=Sum('amount'))['total'] or 0
        budgets = Budget.objects.filter(user=request.user, month=today.month, year=today.year).select_related('category')
        budget_status = []
        for budget in budgets:
            spent = transactions.filter(type='expense', category=budget.category, date__year=today.year, date__month=today.month).aggregate(total=Sum('amount'))['total'] or 0
            budget_status.append({'id': budget.id, 'category': budget.category.name, 'amount': budget.amount, 'spent': spent, 'remaining': budget.amount - spent})
        return Response({
            'income': income, 'expenses': expenses, 'balance': income - expenses,
            'monthly_expenses': monthly_expenses, 'budget_status': budget_status,
            'recent_transactions': TransactionSerializer(transactions.select_related('category')[:5], many=True).data,
        })


from transactions.serializers import TransactionSerializer

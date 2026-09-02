from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from transactions.models import Transaction
from .models import Budget


class BudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    spent = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = ('id', 'category', 'category_name', 'amount', 'month', 'year', 'spent', 'remaining', 'created_at')
        read_only_fields = ('id', 'created_at', 'category_name', 'spent', 'remaining')

    def validate_category(self, category):
        if category.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('Choose one of your own categories.')
        if category.type != 'expense':
            raise serializers.ValidationError('Budgets can only be assigned to expense categories.')
        return category

    def _spent(self, obj):
        return Transaction.objects.filter(
            user=obj.user, category=obj.category, type='expense', date__year=obj.year, date__month=obj.month
        ).aggregate(total=Sum('amount'))['total'] or 0

    def get_spent(self, obj):
        return self._spent(obj)

    def get_remaining(self, obj):
        return obj.amount - Decimal(str(self._spent(obj)))

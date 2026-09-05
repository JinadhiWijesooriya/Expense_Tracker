from decimal import Decimal
from django.db.models import Sum
from rest_framework import serializers
from .models import Account


class AccountSerializer(serializers.ModelSerializer):
    current_balance = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            'id',
            'name',
            'account_type',
            'initial_balance',
            'color',
            'current_balance',
            'created_at',
        ]

    def get_current_balance(self, obj):
        initial = obj.initial_balance or Decimal('0.00')
        income = obj.transactions.filter(type='income').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        expenses = obj.transactions.filter(type='expense').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return str(initial + income - expenses)

from decimal import Decimal
from rest_framework import serializers
from .models import Goal


class GoalSerializer(serializers.ModelSerializer):
    percentage = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()

    class Meta:
        model = Goal
        fields = [
            'id',
            'name',
            'target_amount',
            'current_amount',
            'target_date',
            'color',
            'percentage',
            'remaining_amount',
            'created_at',
        ]

    def get_percentage(self, obj):
        target = Decimal(str(obj.target_amount or 0))
        current = Decimal(str(obj.current_amount or 0))
        if target <= 0:
            return 0
        pct = (current / target) * Decimal(100)
        return min(100.0, round(float(pct), 1))

    def get_remaining_amount(self, obj):
        target = Decimal(str(obj.target_amount or 0))
        current = Decimal(str(obj.current_amount or 0))
        remaining = target - current
        return str(max(Decimal('0.00'), remaining))

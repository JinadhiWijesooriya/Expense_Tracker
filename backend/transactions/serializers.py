from rest_framework import serializers

from categories.models import Category
from .models import Transaction


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True, default='')

    class Meta:
        model = Transaction
        fields = ('id', 'category', 'category_name', 'account', 'account_name', 'amount', 'type', 'description', 'date', 'receipt', 'created_at')
        read_only_fields = ('id', 'created_at', 'category_name', 'account_name')

    def validate_category(self, category):
        if category.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('Choose one of your own categories.')
        return category

    def validate_account(self, account):
        if account and account.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('Choose one of your own accounts.')
        return account

    def validate(self, attrs):
        category = attrs.get('category', getattr(self.instance, 'category', None))
        transaction_type = attrs.get('type', getattr(self.instance, 'type', None))
        if category and transaction_type and category.type != transaction_type:
            raise serializers.ValidationError({'category': 'The category type must match the transaction type.'})
        return attrs

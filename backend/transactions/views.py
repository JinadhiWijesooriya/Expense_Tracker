from rest_framework import viewsets

from .models import Transaction
from .serializers import TransactionSerializer


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    filterset_fields = ('type', 'category', 'date')
    search_fields = ('description', 'category__name')
    ordering_fields = ('date', 'amount', 'created_at')

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).select_related('category')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

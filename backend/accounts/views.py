from rest_framework import permissions, viewsets
from .models import Account
from .serializers import AccountSerializer


class AccountViewSet(viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Account.objects.filter(user=self.request.user)
        if not queryset.exists():
            # Create a default Cash Wallet for user if none exists
            Account.objects.create(
                user=self.request.user,
                name="Cash Wallet",
                account_type="cash",
                initial_balance=0.00,
                color="#1f7a70"
            )
            queryset = Account.objects.filter(user=self.request.user)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

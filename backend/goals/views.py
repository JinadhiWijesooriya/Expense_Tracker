from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal
from .models import Goal
from .serializers import GoalSerializer


class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Goal.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def deposit(self, request, pk=None):
        goal = self.get_object()
        try:
            amount = Decimal(str(request.data.get('amount', 0)))
            if amount <= 0:
                return Response({'error': 'Deposit amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)
            goal.current_amount = Decimal(str(goal.current_amount)) + amount
            goal.save()
            return Response(self.get_serializer(goal).data)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid deposit amount.'}, status=status.HTTP_400_BAD_REQUEST)

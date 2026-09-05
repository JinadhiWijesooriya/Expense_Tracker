from django.conf import settings
from django.db import models


class Account(models.Model):
    ACCOUNT_TYPES = [
        ('cash', 'Cash Wallet'),
        ('bank', 'Bank Account'),
        ('card', 'Credit Card'),
        ('wallet', 'E-Wallet'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='accounts'
    )
    name = models.CharField(max_length=100)
    account_type = models.CharField(
        max_length=20,
        choices=ACCOUNT_TYPES,
        default='cash'
    )
    initial_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00
    )
    color = models.CharField(max_length=20, default='#1f7a70')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['user', 'name'], name='unique_account_per_user'),
        ]

    def __str__(self):
        return f"{self.name} ({self.account_type})"

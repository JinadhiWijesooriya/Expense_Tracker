from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Goal(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='goals'
    )
    name = models.CharField(max_length=100)
    target_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0.01)]
    )
    current_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00
    )
    target_date = models.DateField(null=True, blank=True)
    color = models.CharField(max_length=20, default='#1f7a70')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['target_date', '-created_at']

    def __str__(self):
        return f"{self.name} ({self.current_amount}/{self.target_amount})"

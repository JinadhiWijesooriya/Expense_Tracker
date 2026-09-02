from django.conf import settings
from django.db import models


class Category(models.Model):
    CATEGORY_TYPES = [
        ('income', 'Income'),
        ('expense', 'Expense'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='categories'
    )
    name = models.CharField(max_length=100)
    type = models.CharField(
        max_length=10,
        choices=CATEGORY_TYPES
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['type', 'name']
        constraints = [
            models.UniqueConstraint(fields=['user', 'name', 'type'], name='unique_category_per_user_type'),
        ]

    def __str__(self):
        return f"{self.name} ({self.type})"

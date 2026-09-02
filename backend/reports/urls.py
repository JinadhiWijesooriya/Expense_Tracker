from django.urls import path

from .views import CategoryReportView, MonthlyReportView

urlpatterns = [
    path('monthly/', MonthlyReportView.as_view()),
    path('categories/', CategoryReportView.as_view()),
]

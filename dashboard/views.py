from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.services import resolve_actor
from dashboard.serializers import DashboardModuleSerializer
from .services import build_dashboard_modules


class DashboardHomeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        modules = build_dashboard_modules(resolve_actor(request))
        return Response({'modules': DashboardModuleSerializer(modules, many=True).data})


class DashboardModuleView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        key = request.query_params.get('key')
        modules = [module for module in build_dashboard_modules(resolve_actor(request)) if module['key'] == key] if key else build_dashboard_modules(resolve_actor(request))
        return Response({'modules': DashboardModuleSerializer(modules, many=True).data})

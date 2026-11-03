from django.core.management.base import BaseCommand

from accounts import drive_library
from accounts.library_data import LIBRARY_CACHE_KEY
from django.core.cache import cache


class Command(BaseCommand):
    help = "Re-read the library folder (Google Drive or LIBRARY_LOCAL_DIR) and show the collections and books it contains."

    def handle(self, *args, **options):
        if not drive_library.is_configured():
            self.stdout.write(self.style.WARNING(
                "No library folder is configured. Set LIBRARY_DRIVE_FOLDER_ID (and share the folder as 'Anyone with the link', "
                "or add GOOGLE_DRIVE_API_KEY / GOOGLE_SERVICE_ACCOUNT_JSON), or set LIBRARY_LOCAL_DIR."))
            return
        report = drive_library.status_report()
        cache.delete(LIBRARY_CACHE_KEY)
        self.stdout.write("Source: %s (%s)" % (report["source"], report["mode"]))
        if report["error"]:
            self.stdout.write(self.style.ERROR("Problem: " + report["error"]))
            return
        for c in report["collections"]:
            self.stdout.write(self.style.SUCCESS("%s  (%d)" % (c["label"], c["count"])))
            for it in report["items"]:
                if it["category"] == c["label"]:
                    sub = (it["subcategory"] + " › ") if it["subcategory"] else ""
                    self.stdout.write("    %s%s  [%s]  /library/%s/" % (sub, it["name"], it["size_label"] or "size n/a", it["slug"]))
        self.stdout.write(self.style.SUCCESS("%d books in %d collections." % (report["books"], len(report["collections"]))))

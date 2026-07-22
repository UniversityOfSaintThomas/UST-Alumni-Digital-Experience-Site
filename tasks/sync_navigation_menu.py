import re

from simple_salesforce import format_soql

from cumulusci.core.exceptions import CumulusCIException
from cumulusci.tasks.salesforce import BaseSalesforceApiTask


class SyncNavigationMenuBinding(BaseSalesforceApiTask):
    """
    Salesforce auto-generates the DeveloperName of a site's Default Navigation
    NavigationLinkSet (e.g. Default_Navigation, Default_Navigation1, ...),
    numbered by creation order across the whole org. The theme layout's
    Navigation Menu component binds to that DeveloperName by value, and
    Salesforce won't allow renaming a site's Default Navigation menu to make
    the value deterministic. This task looks up today's actual DeveloperName
    and rewrites the binding in the theme layout content.json before it's
    deployed, so the binding is correct regardless of org history.
    """

    task_options = {
        "network_name": {
            "description": "Name of the Network whose Default Navigation menu binding should be synced.",
            "required": False,
        },
        "content_path": {
            "description": "Path to the theme layout content.json file containing the navigationMenuEditor binding.",
            "required": False,
        },
    }

    def _init_options(self, kwargs):
        super()._init_options(kwargs)
        self.options.setdefault("network_name", "Alumni")
        self.options.setdefault(
            "content_path",
            "unpackaged/config/experiences/digitalExperiences/site/Alumni1/sfdc_cms__themeLayout/scopedHeaderAndFooter/content.json",
        )

    def _run_task(self):
        network_name = self.options["network_name"]
        content_path = self.options["content_path"]

        networks = self.sf.query(
            format_soql("SELECT Id FROM Network WHERE Name = {name}", name=network_name)
        )
        if not networks["records"]:
            raise CumulusCIException(f'No Network record found with Name "{network_name}"')
        network_id = networks["records"][0]["Id"]

        nav_menus = self.sf.query(
            format_soql(
                "SELECT DeveloperName FROM NavigationLinkSet "
                "WHERE NetworkId = {network_id} AND MasterLabel = 'Default Navigation'",
                network_id=network_id,
            )
        )
        if not nav_menus["records"]:
            raise CumulusCIException(
                f'No Default Navigation NavigationLinkSet found for Network "{network_name}"'
            )
        developer_name = nav_menus["records"][0]["DeveloperName"]

        with open(content_path, "r", encoding="utf-8") as f:
            content = f.read()

        updated_content, count = re.subn(
            r'("navigationMenuEditor"\s*:\s*")[^"]*(")',
            rf"\g<1>{developer_name}\g<2>",
            content,
        )
        if count == 0:
            raise CumulusCIException(f"No navigationMenuEditor binding found in {content_path}")

        with open(content_path, "w", encoding="utf-8") as f:
            f.write(updated_content)

        self.logger.info(
            f'Updated {count} navigationMenuEditor binding(s) in {content_path} to "{developer_name}"'
        )

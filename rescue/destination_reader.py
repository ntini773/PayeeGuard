"""The investigator sees a fixed backend scope and no mutation interface."""
from .destination_errors import DestinationError


class BackendCaseReader:
    def __init__(self, service, token, case_id):
        self._service, self._token, self._case_id = service, token, case_id
        principal = service.store.principal(token)
        self._scope = (principal.user, principal.tenant, principal.seller)

    def _check(self):
        p = self._service.store.principal(self._token)
        if self._scope != (p.user, p.tenant, p.seller):
            raise DestinationError('SELLER_SCOPE_DENIED', 403)

    def snapshot(self):
        self._check()
        view = self._service.status(self._token, self._case_id)
        # Do not feed earlier AI output back as verified evidence.
        return {field: view[field] for field in ('state', 'version', 'policy_decision',
                'authentication', 'marketplace_review', 'destinations', 'payout_control', 'cooling_off')}

    def seller_messages(self):
        self._check()
        return self._service.seller_messages(self._token, self._case_id)

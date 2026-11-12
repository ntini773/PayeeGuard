import tempfile
from pathlib import Path
from rescue.store import Store
from rescue.destination_store import DestinationStore
from rescue.destination_service import DestinationService


class DestinationFixture:
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.identity = Store(Path(self.tmp.name) / 'test.sqlite3')
        self.ds = DestinationStore(self.identity)
        self.tokens = {}
        for user, tenant, seller, manage, review, channel in [
            ('owner', 't1', 's1', True, False, 'browser'),
            ('staff', 't1', 's1', False, False, 'browser'),
            ('reviewer', 't1', 's1', False, True, 'browser'),
            ('other', 't1', 's2', True, False, 'browser'),
            ('tenant', 't2', 's1', True, False, 'browser'),
            ('external', 't1', 's1', True, False, 'external'),
        ]:
            self.identity.add_user(user, 'operator', 'fixture-password')
            self.ds.provision_grant(user, tenant, seller, manage=manage, review=review, channel=channel)
            self.tokens[user] = self.identity.login(user, 'fixture-password')
        for tenant, seller in [('t1', 's1'), ('t1', 's2'), ('t2', 's1')]:
            self.ds.provision_payee(tenant, seller, 'AAAAAAAAAAAAA')
        self.now = 1800000000.0
        self.service = DestinationService(self.ds, clock=lambda: self.now)
        self.case = self.service.create(self.tokens['owner'], {'reason_text': 'I opened a new account'}, 'request-1')
        self.case_id = self.case['case_id']

    def authenticate_destination(self, purpose='NEW', payer='BBBBBBBBBBBBB'):
        from unittest.mock import Mock
        state = self.service.begin_auth(self.tokens['owner'], self.case_id, purpose)
        provider = Mock()
        provider.identity.return_value = {'payer_id': payer, 'verified_account': True}
        return self.service.callback(self.tokens['owner'], self.case_id, purpose, state, 'synthetic-code', provider,
                                     'https://example.test/callback')

    def ready_for_review(self, recovery=False):
        self.authenticate_destination()
        if recovery:
            self.service.recovery(self.tokens['owner'], self.case_id, 'Lost old login')
        else:
            self.authenticate_destination('OLD', 'AAAAAAAAAAAAA')
        view = self.service.status(self.tokens['owner'], self.case_id)
        return self.service.record_evidence(self.tokens['reviewer'], self.case_id,
            kind='ACCOUNT_RECOVERY' if recovery else 'SELLER_ENTITLEMENT', reference='marketplace-record-1',
            reason='Verified against marketplace-owned records', accepted=True, expected_version=view['version'])

    def approve(self, recovery=False):
        view = self.ready_for_review(recovery)
        return self.service.review(self.tokens['reviewer'], self.case_id, 'APPROVE', 'Required evidence reviewed', view['version'])


class FakePayoutProvider:
    simulated = True

    def __init__(self):
        self.creates = []
        self.fail_create = False
        self.fail_read = False
        self.result_status = 'SUCCESS'

    def create(self, payload):
        self.creates.append(payload)
        if self.fail_create:
            raise TimeoutError('provider secret')
        return {'batch_header': {'payout_batch_id': 'TEST-BATCH'}}

    def batch(self, batch_id):
        if self.fail_read:
            raise TimeoutError('provider secret')
        payload = self.creates[-1]
        return {'batch_header': {'payout_batch_id': batch_id, 'sender_batch_header': payload['sender_batch_header']},
                'items': [{'payout_item': payload['items'][0], 'transaction_status': self.result_status}]}

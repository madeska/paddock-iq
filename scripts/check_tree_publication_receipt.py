import unittest, base64, hashlib
from tree_publication_receipt import verify_publication_receipt
class ReceiptTests(unittest.TestCase):
 def receipt(self):return dict(runId=123,commit='a'*40,path='docs/prospective-tree/2026-r18.json')
 def transport(self,created='2026-10-08T10:00:00Z',commit=None,content=b'{"predictions":[]}\n'):
  def fetch(url):
   if '/actions/runs/' in url:return dict(id=123,head_sha=commit or 'a'*40,created_at=created,repository={'full_name':'madeska/paddock-iq'},head_repository={'full_name':'madeska/paddock-iq'},html_url='https://github.com/madeska/paddock-iq/actions/runs/123')
   return dict(type='file',path=self.receipt()['path'],encoding='base64',content=base64.b64encode(content).decode(),sha='b'*40)
  return fetch
 def test_server_timestamp_binds_exact_snapshot_and_tolerates_crlf(self):
  result=verify_publication_receipt(self.receipt(),b'{"predictions":[]}\r\n','2026-10-20T10:00:00Z',self.transport())
  self.assertEqual(result['createdAt'],'2026-10-08T10:00:00Z')
 def test_late_run_rejected(self):
  with self.assertRaises(ValueError):verify_publication_receipt(self.receipt(),b'{"predictions":[]}\n','2026-10-20T10:00:00Z',self.transport(created='2026-10-20T10:00:00Z'))
 def test_changed_commit_rejected(self):
  with self.assertRaises(ValueError):verify_publication_receipt(self.receipt(),b'{"predictions":[]}\n','2026-10-20T10:00:00Z',self.transport(commit='c'*40))
 def test_changed_file_rejected(self):
  with self.assertRaises(ValueError):verify_publication_receipt(self.receipt(),b'{"predictions":[1]}\n','2026-10-20T10:00:00Z',self.transport())
 def test_unsafe_path_rejected(self):
  p=self.receipt();p['path']='../secret'
  with self.assertRaises(ValueError):verify_publication_receipt(p,b'{}','2026-10-20T10:00:00Z',self.transport())
if __name__=='__main__':unittest.main()

import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://powerlotto-serlegolas.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc0NjEzNjcsImlkIjoiMDE5ZGQ4ZjMtYWYwMS03Mzc2LWFiZmEtZDg3MzgwNDlmMmMyIiwicmlkIjoiNzc5YTAwN2QtMWUzZi00YzhmLTg4MjctNzg2YWQ1ODRiMTc4In0.8fLiRIhq8FFOSdpgHpEtHcEBhizecWljpAvtT2WYt-Mmp6h852u-Zepi2az2AmE9oaR5iWWxP80BvpmtXWZ1AQ',
});

try {
  await client.execute("ALTER TABLE plays ADD COLUMN ruota TEXT DEFAULT ''");
  console.log('Colonna ruota aggiunta con successo');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('Colonna ruota gia presente');
  } else {
    console.error('Errore:', e.message);
  }
}

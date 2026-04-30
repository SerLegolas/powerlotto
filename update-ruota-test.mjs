import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://powerlotto-serlegolas.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc0NjEzNjcsImlkIjoiMDE5ZGQ4ZjMtYWYwMS03Mzc2LWFiZmEtZDg3MzgwNDlmMmMyIiwicmlkIjoiNzc5YTAwN2QtMWUzZi00YzhmLTg4MjctNzg2YWQ1ODRiMTc4In0.8fLiRIhq8FFOSdpgHpEtHcEBhizecWljpAvtT2WYt-Mmp6h852u-Zepi2az2AmE9oaR5iWWxP80BvpmtXWZ1AQ',
});

const result = await client.execute({
  sql: 'UPDATE plays SET ruota = ? WHERE id = ?',
  args: ['Bari', '142ca289-bd3e-4705-96c8-a20130b3837c'],
});
console.log('Aggiornato:', result.rowsAffected, 'righe');

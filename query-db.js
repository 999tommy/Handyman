require('dotenv').config({ path: '.env.local' });
const { supabaseAdmin } = require('./src/config/supabase');

async function inspectPolicies() {
  console.log('--- Inspecting database tables and policies ---');
  
  // We can query pg_policies using RPC or check if we can query it using a function or read table metadata
  // Since we cannot run raw SQL via the standard JS client without an RPC, let's try calling a few common RPCs
  // or query profiles/jobs directly to inspect behavior.
  
  // Wait, let's run a raw SQL query if we have an RPC like exec_sql, or if not, let's inspect profiles
  // table RLS policies by trying to insert a dummy row as anon vs admin.
  // Wait, let's check if the table has any RLS policies by reading information_schema or similar.
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { 
    sql: 'SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies' 
  });
  
  if (error) {
    console.log('Could not use exec_sql RPC:', error.message);
    
    // Let's try listing common things
    console.log('Let us try running a custom query against pg_policies via supabaseAdmin.rpc or similar.');
    const { data: data2, error: error2 } = await supabaseAdmin.rpc('get_policies');
    if (error2) {
      console.log('Could not use get_policies RPC:', error2.message);
    } else {
      console.log('Policies list:', data2);
    }
  } else {
    console.log('Active Policies:');
    console.table(data);
  }
}

inspectPolicies()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

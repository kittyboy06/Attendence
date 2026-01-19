
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('Inspecting time_table...');
    const { data, error } = await supabase
        .from('time_table')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) console.error(error);
    else {
        console.log('Latest 10 entries in time_table:');
        data.forEach(d => {
            console.log(`ID: ${d.id}, Day: ${d.day_of_week}, Period: ${d.period_number}, Start: ${d.start_time}, End: ${d.end_time}`);
        });
    }
}

inspect();

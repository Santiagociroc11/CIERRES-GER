import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://atciwdznqidfdcftqjhp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Y2l3ZHpucWlkZmRjZnRxamhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyNjYwMzQsImV4cCI6MjA1NTg0MjAzNH0.LidaNdoKqqgcX7hgXXszKHmG-xKGjbW8teQwmtlYUR8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
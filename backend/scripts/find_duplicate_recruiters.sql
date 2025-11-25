-- SQL query to find duplicate recruiter names
SELECT 
    name,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as recruiter_ids,
    STRING_AGG(email, ', ') as emails
FROM users 
WHERE role = 'Recruiter' 
GROUP BY name 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, name;

-- SQL query to see all recruiters with their IDs
SELECT id, name, email, is_active, created_at
FROM users 
WHERE role = 'Recruiter' 
ORDER BY name, created_at;

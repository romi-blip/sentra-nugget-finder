-- Update existing chat webhook timeout to 180 seconds (180000ms)
UPDATE global_webhooks 
SET timeout = 180000 
WHERE type = 'chat' AND enabled = true;
#!/bin/bash
PROJECT_ID="hdffskijakgxcisxdinf"
# Extract key cleanly, handling potential whitespace
ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d '=' -f2 | tr -d '"' | tr -d ' ')

echo "Starting batch caching for project $PROJECT_ID..."

for i in {1..60}
do
   echo "----------------------------------------"
   echo "Batch $i starting..."
   RESPONSE=$(curl -s -X POST "https://$PROJECT_ID.supabase.co/functions/v1/cache-player-images" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $ANON_KEY" \
     -d '{}')
   
   echo "Response: $RESPONSE"
   
   # Check for completion
   if echo "$RESPONSE" | grep -q '"processed":0'; then
       echo "----------------------------------------"
       echo "All players processed!"
       break
   fi
   
   # Check for errors
   if echo "$RESPONSE" | grep -q '"error"'; then
       echo "Encountered error, retrying in 2s..."
       sleep 2
   else
       sleep 1
   fi
done

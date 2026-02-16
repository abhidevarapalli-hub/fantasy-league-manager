import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAPIDAPI_HOST = "cricbuzz-cricket.p.rapidapi.com";
const BUCKET_NAME = "player-images";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Init Supabase Client with Service Role (for admin writes)
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const rapidApiKey = Deno.env.get("RAPIDAPI_KEY") ?? "";

        if (!supabaseUrl || !supabaseServiceKey || !rapidApiKey) {
            throw new Error("Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or RAPIDAPI_KEY");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 2. Fetch players needing caching (batch size 10 to avoid timeouts)
        const { data: players, error: fetchError } = await supabase
            .from("master_players")
            .select("id, cricbuzz_id, image_id, name")
            .not("image_id", "is", null)
            .is("cached_image_url", null)
            .limit(10);

        if (fetchError) throw fetchError;

        if (!players || players.length === 0) {
            return new Response(
                JSON.stringify({ message: "No players need image caching", count: 0 }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const results = [];

        // 3. Process each player
        for (const player of players) {
            try {
                const imageId = player.image_id;
                // Fetch from Cricbuzz (RapidAPI)
                // Endpoint: /img/v1/i1/c{imageId}/i.jpg
                const apiUrl = `https://${RAPIDAPI_HOST}/img/v1/i1/c${imageId}/i.jpg?p=de&d=high`;

                console.log(`Fetching image for ${player.name} (${imageId}) from Cricbuzz API...`);

                const imageRes = await fetch(apiUrl, {
                    headers: {
                        "X-RapidAPI-Key": rapidApiKey,
                        "X-RapidAPI-Host": RAPIDAPI_HOST,
                    },
                });

                if (!imageRes.ok) {
                    console.error(`Failed to fetch image for ${player.name} (${imageId}): ${imageRes.status}`);
                    results.push({ id: player.id, status: "error", message: `Fetch failed: ${imageRes.status}` });
                    continue;
                }

                const imageBlob = await imageRes.blob();
                if (imageBlob.size === 0) {
                    console.error(`Empty image for ${player.name}`);
                    results.push({ id: player.id, status: "error", message: "Empty image" });
                    continue;
                }

                // Upload to Supabase Storage
                const fileName = `${imageId}.jpg`;
                const { error: uploadError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(fileName, imageBlob, {
                        contentType: "image/jpeg",
                        upsert: true,
                    });

                if (uploadError) throw uploadError;

                // Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(fileName);

                // Update master_players
                const { error: updateError } = await supabase
                    .from("master_players")
                    .update({ cached_image_url: publicUrl })
                    .eq("id", player.id);

                if (updateError) throw updateError;

                results.push({ id: player.id, name: player.name, status: "success", url: publicUrl });
                console.log(`Cached image for ${player.name}`);

            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error(`Error processing ${player.name}:`, errorMessage);
                results.push({ id: player.id, status: "error", message: errorMessage });
            }
        }

        return new Response(
            JSON.stringify({ message: "Batch processing complete", processed: results.length, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

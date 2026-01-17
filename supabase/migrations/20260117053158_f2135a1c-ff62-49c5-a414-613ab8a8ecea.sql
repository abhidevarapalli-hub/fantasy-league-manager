-- Add DELETE policy to players table
CREATE POLICY "Anyone can delete players"
ON public.players
FOR DELETE
USING (true);
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserCircle, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";


const ProfileSetup = () => {
    const user = useAuthStore(state => state.user);
    const userProfile = useAuthStore(state => state.userProfile);
    const updateUsername = useAuthStore(state => state.updateUsername);
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [available, setAvailable] = useState<boolean | null>(null);

    useEffect(() => {
        if (userProfile?.username) {
            navigate("/leagues");
        }
    }, [userProfile, navigate]);

    const checkAvailability = async (val: string) => {
        if (val.length < 3) {
            setAvailable(null);
            return;
        }
        setChecking(true);
        try {
            const { data, error } = await (supabase
                .from("profiles" as any)
                .select("username")
                .eq("username", val.toLowerCase())
                .maybeSingle() as any);

            if (!error) {
                setAvailable(!data);
            }
        } finally {
            setChecking(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || username.length < 3) {
            toast.error("Username must be at least 3 characters");
            return;
        }
        if (available === false) {
            toast.error("Username is already taken");
            return;
        }

        setLoading(true);
        try {
            const { error } = await updateUsername(username.toLowerCase());
            if (error) throw error;
            toast.success("Profile setup complete!");

            // Check if there's a saved redirect (e.g., from join link)
            const redirectPath = sessionStorage.getItem('redirectAfterSetup');
            if (redirectPath) {
                sessionStorage.removeItem('redirectAfterSetup');
                navigate(redirectPath);
            } else {
                navigate("/leagues");
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
            <Card className="max-w-md w-full border-2 border-primary/10 shadow-2xl glass-morphism">
                <CardHeader className="text-center space-y-4">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border-2 border-primary/20 shadow-xl">
                        <UserCircle className="w-12 h-12 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-3xl font-black italic uppercase tracking-tighter">Choose Your Handle</CardTitle>
                        <CardDescription className="text-base font-medium">This will be your identity across all future leagues.</CardDescription>
                    </div>
                </CardHeader>
                <form onSubmit={handleUpdate}>
                    <CardContent className="space-y-6 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Username</Label>
                            <div className="relative">
                                <Input
                                    id="username"
                                    placeholder="cricketpro77"
                                    value={username}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                                        setUsername(val);
                                        checkAvailability(val);
                                    }}
                                    className={cn(
                                        "h-14 text-xl font-bold bg-background/50 pl-4 pr-12 transition-all duration-300",
                                        available === true && "border-green-500/50 focus:border-green-500 bg-green-500/5",
                                        available === false && "border-destructive/50 focus:border-destructive bg-destructive/5",
                                        available === null && "border-primary/20 focus:border-primary"
                                    )}
                                    disabled={loading}
                                    autoComplete="off"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                                    {checking ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    ) : available === true ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-500 animate-in zoom-in duration-300" />
                                    ) : available === false ? (
                                        <AlertCircle className="w-5 h-5 text-destructive animate-in shake duration-300" />
                                    ) : null}
                                </div>
                            </div>

                            <div className="min-h-[20px]">
                                {available === false ? (
                                    <p className="text-xs text-destructive font-bold flex items-center gap-1.5 px-1 py-1 animate-in slide-in-from-top-1 duration-300">
                                        <X className="w-3.5 h-3.5" />
                                        This handle is already taken. Try another?
                                    </p>
                                ) : username.length > 0 && username.length < 3 ? (
                                    <p className="text-xs text-amber-500 font-medium flex items-center gap-1.5 px-1 py-1">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        Username must be at least 3 characters.
                                    </p>
                                ) : (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1 py-1 transition-opacity duration-300">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        Only letters, numbers, and underscores allowed.
                                    </p>
                                )}
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter className="bg-primary/5 border-t border-primary/10 p-6">
                        <Button
                            type="submit"
                            className="w-full h-14 text-lg font-black italic uppercase tracking-tight shadow-lg shadow-primary/20 group"
                            disabled={loading || !available || checking}
                        >
                            {loading ? (
                                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            ) : (
                                "Claim Handle"
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default ProfileSetup;

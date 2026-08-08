import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function ResetHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const validateToken = async () => {
      try {
        const hash = window.location.hash;

        if (!hash) {
          // Si no hay hash, podría ser que Supabase ya lo consumió. Verificamos sesión:
          const { data } = await supabase.auth.getSession();
          if (!data.session && mounted) {
             navigate("/");
          } else if (data.session && mounted) {
             navigate("/nueva-password");
          }
          return;
        }

        const params = new URLSearchParams(hash.replace("#", ""));
        const access_token = params.get("access_token");
        const type = params.get("type");

        if (type === "recovery" && access_token) {
          // Dejamos que Supabase procese el token en background por unos instantes
          setTimeout(async () => {
             const { data: { session }, error } = await supabase.auth.getSession();
             if (mounted) {
               if (!session || error) navigate("/");
               else navigate("/nueva-password");
             }
          }, 1000);
        } else {
          navigate("/");
        }
      } catch (error) {
        console.error("Error procesando token:", error);
        navigate("/");
      }
    };

    validateToken();

    return () => { mounted = false; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-4">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
      <p className="text-zinc-400 font-medium tracking-wide">Validando enlace de recuperación...</p>
    </div>
  );
}

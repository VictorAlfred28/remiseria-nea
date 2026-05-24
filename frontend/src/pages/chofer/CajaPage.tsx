import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BilleteraChofer from "../../components/BilleteraChofer";

export default function CajaPage() {
    const navigate = useNavigate();

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => navigate('/chofer')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 font-medium transition-colors text-sm w-fit">
                <ArrowLeft size={18} /> Volver al Panel
            </button>
            <BilleteraChofer />
        </div>
    );
}

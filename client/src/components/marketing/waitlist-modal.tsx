import React, { useState } from "react";
import { logger } from "../../lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useToast } from "../../hooks/use-toast";
import { Sparkles } from "lucide-react";

export function WaitlistModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar el email
    if (!email || !email.includes('@')) {
      toast({
        title: "Error",
        description: "Por favor, introduce un email válido",
        variant: "destructive",
      });
      return;
    }

    // Simulación de envío al backend
    logger.info("Submitting email:", email);
    
    // Mostrar estado de éxito
    setSubmitted(true);
    
    toast({
      title: "¡Genial!",
      description: "Te has unido a nuestra lista de espera. ¡Gracias!",
    });
    
    // Cerrar el modal después de 2 segundos
    setTimeout(() => {
      setOpen(false);
      // Resetear el estado después de cerrar
      setTimeout(() => setSubmitted(false), 300);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30 hover:text-orange-300">
          <Sparkles className="mr-2 h-4 w-4" />
          Unirse a la lista de espera
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Únete a la lista de espera de Boostify Music</DialogTitle>
        </DialogHeader>
        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="flex flex-col space-y-2">
              <p className="text-sm text-muted-foreground">
                Sé uno de los primeros en acceder a nuestra plataforma cuando se lance. Recibirás acceso prioritario y beneficios exclusivos.
              </p>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Unirse ahora</Button>
            </div>
          </form>
        ) : (
          <div className="py-6 text-center space-y-4">
            <div className="bg-green-500/20 text-green-500 rounded-full p-3 inline-flex justify-center">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-medium">¡Te has unido correctamente!</h3>
            <p className="text-sm text-muted-foreground">
              Te mantendremos informado sobre nuestro lanzamiento y novedades.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
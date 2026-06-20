import React, { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";

interface AdvancedSearchProps {
  onResults?: (results: any[]) => void;
}

const GENRES = [
  "Pop",
  "Rock",
  "Hip-Hop",
  "Electronic",
  "Latin",
  "Jazz",
  "Classical",
  "Country",
  "R&B",
  "Reggaeton",
];

export function AdvancedSearch({ onResults }: AdvancedSearchProps) {
  const [keyword, setKeyword] = useState("");
  const [genre, setGenre] = useState("");
  const [location, setLocation] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: results, isLoading } = useQuery({
    queryKey: ["/api/social/users/search", { keyword, genre, location }],
    queryFn: async () => {
      if (!keyword && !genre && !location) return [];
      return apiRequest({
        url: "/api/social/users/search",
        method: "GET",
      }) as Promise<any[]>;
    },
  });

  React.useEffect(() => {
    if (results) onResults?.(results);
  }, [results]);

  const handleClear = () => {
    setKeyword("");
    setGenre("");
    setLocation("");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Buscar artista..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          variant={isOpen ? "default" : "outline"}
          className="gap-2"
        >
          <Search className="h-4 w-4" />
          Filtros
        </Button>
      </div>

      {isOpen && (
        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger>
              <SelectValue placeholder="Género" />
            </SelectTrigger>
            <SelectContent>
              {GENRES.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Ubicación"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          {(keyword || genre || location) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="col-span-2 gap-2"
            >
              <X className="h-4 w-4" />
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Buscando...</p>}
    </div>
  );
}

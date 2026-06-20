import { useState } from "react";
import { logger } from "../../lib/logger";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { useToast } from "../../hooks/use-toast";
import { Pencil, Trash2, Wand2, Loader2, Plus } from "lucide-react";
import { queryClient } from "../../lib/query-client";
import { AddMusicianForm } from "./add-musician-form";

interface Musician {
  id: number;
  name: string;
  photo: string;
  instrument: string;
  category: string;
  description: string;
  price: string | number;
  rating: string | number;
  totalReviews: number;
  genres: string[];
  isActive: boolean;
}

export function AdminMusiciansPanel() {
  const { toast } = useToast();
  const [editingMusician, setEditingMusician] = useState<Musician | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [enhancingId, setEnhancingId] = useState<number | null>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['/api/musicians'],
    refetchInterval: 5000,
  });

  const musicians = response?.success ? response.data : [];

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/musicians/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete musician');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/musicians'] });
      toast({
        title: "Success",
        description: "Musician deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete musician",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (musician: Musician) => {
      const response = await fetch(`/api/musicians/${musician.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: musician.name,
          description: musician.description,
          price: typeof musician.price === 'string' ? musician.price : String(musician.price),
          instrument: musician.instrument,
          category: musician.category,
          genres: musician.genres,
          isActive: musician.isActive,
        }),
      });
      if (!response.ok) throw new Error('Failed to update musician');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/musicians'] });
      setIsEditDialogOpen(false);
      setEditingMusician(null);
      toast({
        title: "Success",
        description: "Musician updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update musician",
        variant: "destructive",
      });
    },
  });

  const enhanceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/musicians/${id}/enhance-description`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to enhance description');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/musicians'] });
      setEnhancingId(null);
      toast({
        title: "Success",
        description: "Description enhanced with AI!",
      });
    },
    onError: () => {
      setEnhancingId(null);
      toast({
        title: "Error",
        description: "Failed to enhance description",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (musician: Musician) => {
    setEditingMusician({ ...musician });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this musician?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEnhance = async (id: number) => {
    setEnhancingId(id);
    enhanceMutation.mutate(id);
  };

  const handleUpdate = () => {
    if (editingMusician) {
      updateMutation.mutate(editingMusician);
    }
  };

  const handleMusicianAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/musicians'] });
    setIsAddDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Manage Musicians</h2>
          <p className="text-muted-foreground">
            Edit, delete, or enhance musician profiles
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-musician">
              <Plus className="mr-2 h-4 w-4" />
              Add Musician
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Musician</DialogTitle>
              <DialogDescription>
                Create a new musician profile with AI-generated photo
              </DialogDescription>
            </DialogHeader>
            <AddMusicianForm onMusicianAdded={handleMusicianAdded} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Instrument</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {musicians?.map((musician) => (
              <TableRow key={musician.id}>
                <TableCell>
                  <img
                    src={musician.photo}
                    alt={musician.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                </TableCell>
                <TableCell className="font-medium">{musician.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{musician.instrument}</Badge>
                </TableCell>
                <TableCell>${musician.price}</TableCell>
                <TableCell>⭐ {musician.rating}</TableCell>
                <TableCell>
                  <Badge variant={musician.isActive ? "default" : "secondary"}>
                    {musician.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEnhance(musician.id)}
                    disabled={enhancingId === musician.id}
                    data-testid={`button-enhance-${musician.id}`}
                  >
                    {enhancingId === musician.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(musician)}
                    data-testid={`button-edit-${musician.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(musician.id)}
                    data-testid={`button-delete-${musician.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Musician</DialogTitle>
            <DialogDescription>
              Update musician information
            </DialogDescription>
          </DialogHeader>
          {editingMusician && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editingMusician.name}
                  onChange={(e) =>
                    setEditingMusician({ ...editingMusician, name: e.target.value })
                  }
                  data-testid="input-edit-name"
                />
              </div>
              <div>
                <Label>Instrument</Label>
                <Input
                  value={editingMusician.instrument}
                  onChange={(e) =>
                    setEditingMusician({ ...editingMusician, instrument: e.target.value })
                  }
                  data-testid="input-edit-instrument"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={editingMusician.category}
                  onValueChange={(value) =>
                    setEditingMusician({ ...editingMusician, category: value })
                  }
                >
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Guitar">Guitar</SelectItem>
                    <SelectItem value="Drums">Drums</SelectItem>
                    <SelectItem value="Piano">Piano</SelectItem>
                    <SelectItem value="Vocals">Vocals</SelectItem>
                    <SelectItem value="Brass">Brass</SelectItem>
                    <SelectItem value="Strings">Strings</SelectItem>
                    <SelectItem value="Production">Production</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingMusician.description}
                  onChange={(e) =>
                    setEditingMusician({ ...editingMusician, description: e.target.value })
                  }
                  rows={4}
                  data-testid="textarea-edit-description"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Price ($)</Label>
                  <Input
                    type="number"
                    value={editingMusician.price}
                    onChange={(e) =>
                      setEditingMusician({ ...editingMusician, price: e.target.value })
                    }
                    data-testid="input-edit-price"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={editingMusician.isActive ? "active" : "inactive"}
                    onValueChange={(value) =>
                      setEditingMusician({ ...editingMusician, isActive: value === "active" })
                    }
                  >
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

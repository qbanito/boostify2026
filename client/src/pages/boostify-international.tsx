import { Header } from "../components/layout/header";
import { logger } from "../lib/logger";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { motion } from "framer-motion";
import { Input } from "../components/ui/input";
import { useToast } from "../hooks/use-toast";
import { Link } from "wouter";
import { Globe, Home, Building2, Languages, Users, MapPin, BriefcaseIcon, Bot, Check } from "lucide-react";
import { useState } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "../components/ui/drawer";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import cn from 'classnames';
import { Badge } from "../components/ui/badge";
import { CircularProgress } from "../components/ui/circular-progress";

interface Country {
  id: string;
  name: string;
  nativeName: string;
  flag: string;
  departments: Department[];
  region?: string;
  employeeCount?: number;
  established?: string;
}

interface Department {
  id: string;
  name: string;
  localName: string;
  employees: number;
  description?: string;
  status?: 'active' | 'expanding' | 'new';
  automationLevel?: number;
  assistantTypes?: {
    type: string;
    count: number;
    functions: string[];
    efficiency?: number;
  }[];
}

const applicationFormSchema = z.object({
  fullName: z.string().min(2, "El nombre completo es requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(6, "Número de teléfono inválido"),
  country: z.string().min(1, "Selecciona un país"),
  department: z.string().min(1, "Selecciona un departamento"),
  experience: z.string().min(50, "Por favor proporciona más detalles sobre tu experiencia"),
  languages: z.string().min(1, "Lista los idiomas que hablas"),
});

export default function BoostifyInternational() {
  const { toast } = useToast();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const form = useForm<z.infer<typeof applicationFormSchema>>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      country: "",
      department: "",
      experience: "",
      languages: "",
    },
  });

  const countries: Country[] = [
    {
      id: "fr",
      name: "France",
      nativeName: "France",
      flag: "🇫🇷",
      departments: [
        { id: "fr-marketing", name: "Marketing", localName: "Marketing", employees: 5, description: "Marketing Department", automationLevel: 85, assistantTypes: [{ type: "Content Writer", count: 2, functions: ["Content Creation", "SEO Optimization"], efficiency: 90 }, { type: "Social Media Assistant", count: 3, functions: ["Scheduling", "Engagement Analysis"], efficiency: 80 }] },
        { id: "fr-sales", name: "Sales", localName: "Ventes", employees: 5, description: "Sales Department", automationLevel: 70, assistantTypes: [{ type: "Lead Generation Assistant", count: 2, functions: ["Lead Qualification", "Data Entry"], efficiency: 75 }, { type: "Sales Reporting Assistant", count: 3, functions: ["Sales Data Analysis", "Reporting"], efficiency: 65 }] },
        { id: "fr-tech", name: "Technology", localName: "Technologie", employees: 5, description: "Technology Department", automationLevel: 95, assistantTypes: [{ type: "Code Assistant", count: 2, functions: ["Code Generation", "Bug Fixing"], efficiency: 92 }, { type: "DevOps Assistant", count: 3, functions: ["Deployment", "Monitoring"], efficiency: 88 }] }
      ]
    },
    {
      id: "in",
      name: "India",
      nativeName: "भारत",
      flag: "🇮🇳",
      departments: [
        { id: "in-marketing", name: "Marketing", localName: "विपणन", employees: 5, description: "Marketing Department", automationLevel: 80, assistantTypes: [{ type: "Content Writer", count: 2, functions: ["Content Creation", "SEO Optimization"], efficiency: 85 }, { type: "Social Media Assistant", count: 3, functions: ["Scheduling", "Engagement Analysis"], efficiency: 75 }] },
        { id: "in-sales", name: "Sales", localName: "बिक्री", employees: 5, description: "Sales Department", automationLevel: 65, assistantTypes: [{ type: "Lead Generation Assistant", count: 2, functions: ["Lead Qualification", "Data Entry"], efficiency: 70 }, { type: "Sales Reporting Assistant", count: 3, functions: ["Sales Data Analysis", "Reporting"], efficiency: 60 }] },
        { id: "in-tech", name: "Technology", localName: "प्रौद्योगिकी", employees: 5, description: "Technology Department", automationLevel: 90, assistantTypes: [{ type: "Code Assistant", count: 2, functions: ["Code Generation", "Bug Fixing"], efficiency: 88 }, { type: "DevOps Assistant", count: 3, functions: ["Deployment", "Monitoring"], efficiency: 80 }] }
      ]
    },
    {
      id: "us",
      name: "United States",
      nativeName: "United States",
      flag: "🇺🇸",
      departments: [
        { id: "us-marketing", name: "Marketing", localName: "Marketing", employees: 5, description: "Marketing Department", automationLevel: 90, assistantTypes: [{ type: "Content Writer", count: 2, functions: ["Content Creation", "SEO Optimization"], efficiency: 95 }, { type: "Social Media Assistant", count: 3, functions: ["Scheduling", "Engagement Analysis"], efficiency: 85 }] },
        { id: "us-sales", name: "Sales", localName: "Sales", employees: 5, description: "Sales Department", automationLevel: 75, assistantTypes: [{ type: "Lead Generation Assistant", count: 2, functions: ["Lead Qualification", "Data Entry"], efficiency: 80 }, { type: "Sales Reporting Assistant", count: 3, functions: ["Sales Data Analysis", "Reporting"], efficiency: 70 }] },
        { id: "us-tech", name: "Technology", localName: "Technology", employees: 5, description: "Technology Department", automationLevel: 98, assistantTypes: [{ type: "Code Assistant", count: 2, functions: ["Code Generation", "Bug Fixing"], efficiency: 95 }, { type: "DevOps Assistant", count: 3, functions: ["Deployment", "Monitoring"], efficiency: 90 }] }
      ]
    },
    {
      id: "jp",
      name: "Japan",
      nativeName: "日本",
      flag: "🇯🇵",
      region: "Asia",
      employeeCount: 8,
      established: "2022",
      departments: [
        {
          id: "jp-marketing",
          name: "Marketing",
          localName: "マーケティング",
          employees: 5,
          status: 'active',
          automationLevel: 92,
          assistantTypes: [
            {
              type: "Content Generator",
              count: 2,
              functions: ["Generación de contenido multilingüe", "Optimización SEO", "Análisis de tendencias"],
              efficiency: 95
            },
            {
              type: "Social Media Manager",
              count: 3,
              functions: ["Programación de posts", "Análisis de engagement", "Respuesta automática"],
              efficiency: 88
            }
          ]
        },
      ]
    },
  ];


  const handleDepartmentAction = (countryId: string, departmentId: string) => {
    toast({
      title: "Department Action",
      description: `Action triggered for department ${departmentId} in country ${countryId}`,
    });
  };

  const onSubmitApplication = (values: z.infer<typeof applicationFormSchema>) => {
    toast({
      title: "Application Submitted",
      description: "Your application has been received. We'll be in touch soon.",
    });
    logger.info(values);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-20">
        <div className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <Globe className="w-12 h-12 text-orange-500" />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full bg-orange-500/20"
                />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-600">
                  Boostify International
                </h1>
                <p className="text-muted-foreground mt-2">
                  Global Departments and Translations Management
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Drawer>
                <DrawerTrigger asChild>
                  <Button className="gap-2 bg-orange-500 hover:bg-orange-600">
                    <BriefcaseIcon className="w-4 h-4" />
                    Apply Now
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <div className="mx-auto w-full max-w-2xl">
                    <DrawerHeader>
                      <DrawerTitle>Apply for International Position</DrawerTitle>
                      <DrawerDescription>
                        Fill out the form below to apply for a position in our international offices.
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4">
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmitApplication)} className="space-y-6">
                          <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Full Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="John Doe" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input type="email" placeholder="you@example.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Phone Number</FormLabel>
                                  <FormControl>
                                    <Input type="tel" placeholder="+1234567890" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="country"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Country</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select country" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {countries.map((country) => (
                                        <SelectItem key={country.id} value={country.id}>
                                          <span className="mr-2">{country.flag}</span>
                                          {country.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="department"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Department</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select department" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {countries
                                        .find(c => c.id === form.watch('country'))
                                        ?.departments.map((dept) => (
                                          <SelectItem key={dept.id} value={dept.id}>
                                            {dept.name}
                                          </SelectItem>
                                        )) || []}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="languages"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Languages</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="English, Spanish, French..."
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  List all languages you speak, separated by commas
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="experience"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Professional Experience</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Tell us about your relevant experience..."
                                    className="min-h-[100px]"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600">
                            Submit Application
                          </Button>
                        </form>
                      </Form>
                    </div>
                  </div>
                </DrawerContent>
              </Drawer>
              <Link href="/dashboard">
                <Button variant="outline" className="gap-2">
                  <Home className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {countries.map((country, index) => (
              <motion.div
                key={country.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                onHoverStart={() => setHoveredCountry(country.id)}
                onHoverEnd={() => setHoveredCountry(null)}
              >
                <Card
                  className={cn(
                    "group p-6 hover:bg-orange-500/5 transition-all duration-300 cursor-pointer border-orange-500/20",
                    "transform hover:-translate-y-1 hover:shadow-lg",
                    hoveredCountry === country.id && "ring-2 ring-orange-500"
                  )}
                  onClick={() => setSelectedCountry(country.id)}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <span className="text-4xl filter drop-shadow-md">{country.flag}</span>
                      {country.established && (
                        <div className="absolute -top-2 -right-2">
                          <Badge variant="secondary" className="text-xs">
                            Est. {country.established}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">{country.name}</h3>
                      <p className="text-sm text-muted-foreground">{country.nativeName}</p>
                      {country.region && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-orange-500" />
                          <span className="text-xs text-muted-foreground">{country.region}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {country.departments.map((dept) => (
                      <div
                        key={dept.id}
                        className="flex flex-col p-4 rounded-lg bg-background/50 backdrop-blur-sm border border-orange-500/20 hover:border-orange-500/40 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-orange-500" />
                            <div>
                              <span className="font-medium">{dept.localName}</span>
                              <div className="flex items-center gap-1 mt-1">
                                <Bot className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {dept.employees} asistentes automatizados
                                </span>
                              </div>
                            </div>
                          </div>
                          {dept.automationLevel && (
                            <div className="flex items-center gap-2">
                              <CircularProgress
                                value={dept.automationLevel}
                                className="w-8 h-8"
                                strokeWidth={8}
                              >
                                <span className="text-xs font-medium">{dept.automationLevel}%</span>
                              </CircularProgress>
                            </div>
                          )}
                        </div>

                        {dept.assistantTypes?.map((assistant, idx) => (
                          <div
                            key={idx}
                            className="mt-2 p-2 rounded-md bg-orange-500/5 hover:bg-orange-500/10 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{assistant.type}</span>
                              <Badge variant="outline" className="text-xs">
                                x{assistant.count}
                              </Badge>
                            </div>
                            <div className="mt-1 space-y-1">
                              {assistant.functions.map((func, fidx) => (
                                <div key={fidx} className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Check className="w-3 h-3 text-green-500" />
                                  <span>{func}</span>
                                </div>
                              ))}
                            </div>
                            {assistant.efficiency && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1 bg-orange-500/20 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-orange-500 rounded-full transition-all duration-500"
                                    style={{ width: `${assistant.efficiency}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {assistant.efficiency}% eficiencia
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-orange-500/20">
                    <Button
                      variant="outline"
                      className="w-full bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20
                               transform transition-all duration-300 hover:scale-105"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDepartmentAction(country.id, country.departments[0].id);
                      }}
                    >
                      <Languages className="w-4 h-4 mr-2" />
                      Manage Translations
                    </Button>
                  </div>

                  {country.employeeCount && (
                    <div className="mt-4 pt-4 border-t border-orange-500/20">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Total Employees</span>
                        <span className="font-semibold text-foreground">{country.employeeCount}</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-orange-500/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${(country.employeeCount / 200) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
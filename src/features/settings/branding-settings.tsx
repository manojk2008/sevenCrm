"use client";

import { useState } from "react";
import { Upload, Palette, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export function BrandingSettings() {
  const [color, setColor] = useState("#4f46e5"); // indigo-600

  const handleSave = () => {
    toast.success("Branding settings saved successfully.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold">Branding</h3>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of your CRM and customer-facing documents.
        </p>
      </div>
      
      <div className="h-px bg-border w-full my-6" />

      <div className="grid md:grid-cols-2 gap-10">
        <div className="space-y-8">
          <div className="space-y-3">
            <Label>Company Logo</Label>
            <div className="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                <Upload className="h-6 w-6" />
              </div>
              <p className="font-medium">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground mt-1">SVG, PNG, JPG or GIF (max. 2MB)</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Primary Color</Label>
            <div className="flex gap-4 items-center">
              <div 
                className="w-12 h-12 rounded-xl shadow-inner border"
                style={{ backgroundColor: color }}
              />
              <div className="flex-1 relative">
                <Palette className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="text" 
                  value={color} 
                  onChange={(e) => setColor(e.target.value)} 
                  className="pl-9 rounded-xl font-mono"
                />
              </div>
              <Input 
                type="color" 
                value={color} 
                onChange={(e) => setColor(e.target.value)} 
                className="w-12 h-12 p-1 rounded-xl cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Quotation Header Text</Label>
            <Input defaultValue="Quotation" className="rounded-xl" />
          </div>

          <div className="space-y-3">
            <Label>Quotation Footer Text</Label>
            <Textarea 
              defaultValue="Thank you for your business. Terms & Conditions apply." 
              className="rounded-xl min-h-[100px]"
            />
          </div>

          <Button onClick={handleSave} className="rounded-xl px-8">Save Branding</Button>
        </div>

        <div>
          <Label className="mb-3 block">Preview</Label>
          <Card className="rounded-2xl border overflow-hidden shadow-lg">
            <div className="h-2 w-full" style={{ backgroundColor: color }} />
            <CardContent className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div className="h-10 w-32 bg-muted rounded animate-pulse" />
                <div className="text-right">
                  <h3 className="font-bold text-lg">QUOTATION</h3>
                  <p className="text-sm text-muted-foreground">#QT-2024-001</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
              </div>
              
              <div className="pt-6 border-t flex justify-end">
                <div 
                  className="px-6 py-2 rounded-lg text-white font-medium flex items-center gap-2 text-sm"
                  style={{ backgroundColor: color }}
                >
                  <Check className="h-4 w-4" /> Accept Quotation
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FontSelectorProps {
  label: string;
  fontValue: string;
  weightValue: string;
  onFontChange: (value: string) => void;
  onWeightChange: (value: string) => void;
}

const fonts = [
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Montserrat', label: 'Montserrat' },
];

const weights = [
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi-bold' },
  { value: '700', label: 'Bold' },
];

const FontSelector: React.FC<FontSelectorProps> = ({
  label,
  fontValue,
  weightValue,
  onFontChange,
  onWeightChange,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        <Select value={fontValue} onValueChange={onFontChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select font" />
          </SelectTrigger>
          <SelectContent>
            {fonts.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={weightValue} onValueChange={onWeightChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Weight" />
          </SelectTrigger>
          <SelectContent>
            {weights.map((weight) => (
              <SelectItem key={weight.value} value={weight.value}>
                {weight.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p
        className="text-sm text-muted-foreground mt-1"
        style={{ fontFamily: fontValue, fontWeight: parseInt(weightValue) }}
      >
        Preview: The quick brown fox jumps over the lazy dog
      </p>
    </div>
  );
};

export default FontSelector;

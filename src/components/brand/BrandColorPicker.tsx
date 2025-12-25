import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface BrandColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const BrandColorPicker: React.FC<BrandColorPickerProps> = ({ label, value, onChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 rounded-lg cursor-pointer border border-border"
            style={{ backgroundColor: value }}
          />
        </div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="w-28 font-mono text-sm"
        />
      </div>
    </div>
  );
};

export default BrandColorPicker;

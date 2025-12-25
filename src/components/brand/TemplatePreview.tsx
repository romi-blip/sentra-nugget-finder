import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye } from 'lucide-react';

const TemplatePreview: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Eye className="h-4 w-4" />
          Preview Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-poppins">Sentra Document Template Preview</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="cover" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cover">Cover Page</TabsTrigger>
            <TabsTrigger value="toc">Table of Contents</TabsTrigger>
            <TabsTrigger value="content">Content Page</TabsTrigger>
          </TabsList>

          {/* Cover Page Preview */}
          <TabsContent value="cover" className="mt-4">
            <div className="bg-white rounded-lg shadow-lg p-8 min-h-[600px] relative border">
              {/* Sentra Logo */}
              <div className="text-2xl font-bold text-gray-900 mb-2">sentra</div>
              
              {/* Confidential Badge */}
              <div className="absolute top-8 right-8 text-sm text-gray-500">
                🔒 CONFIDENTIAL — Internal Use Only
              </div>

              {/* Main Content */}
              <div className="mt-24">
                {/* Category Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[#39FF14] text-lg">●</span>
                  <span className="text-[#39FF14] font-bold text-sm tracking-wider">
                    TECHNICAL WHITEPAPER
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-4xl font-bold text-gray-900 mb-8 leading-tight">
                  Autonomous Classification using AI-Based Classification Analysis
                </h1>
              </div>

              {/* Metadata Grid */}
              <div className="mt-16 grid grid-cols-2 gap-8">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    PREPARED FOR
                  </div>
                  <div className="text-base font-semibold text-gray-900">
                    Enterprise Customers
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    VERSION
                  </div>
                  <div className="text-base font-semibold text-gray-900">
                    v1.0
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    AUTHOR
                  </div>
                  <div className="text-base font-semibold text-gray-900">
                    Sentra, Inc.
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    DATE
                  </div>
                  <div className="text-base font-semibold text-gray-900">
                    December 25, 2025
                  </div>
                </div>
              </div>

              {/* System Secure Badge */}
              <div className="mt-12 flex items-center gap-2">
                <span className="text-[#39FF14] text-sm">●</span>
                <span className="text-gray-500 text-xs">SYSTEM_SECURE</span>
              </div>

              {/* Colored Footer Bar */}
              <div className="absolute bottom-0 left-0 right-0 flex h-2">
                <div className="flex-1 bg-[#39FF14]" />
                <div className="flex-1 bg-[#FF1493]" />
                <div className="flex-1 bg-[#FFD700]" />
                <div className="flex-1 bg-[#00FFFF]" />
              </div>
            </div>
          </TabsContent>

          {/* Table of Contents Preview */}
          <TabsContent value="toc" className="mt-4">
            <div className="bg-white rounded-lg shadow-lg p-8 min-h-[600px] border">
              {/* Header */}
              <div className="flex items-center border-b-2 border-[#39FF14] pb-2 mb-8">
                <span className="font-bold text-gray-900">sentra</span>
                <span className="text-gray-500 ml-2">| WHITEPAPER</span>
              </div>

              {/* TOC Title */}
              <h2 className="text-3xl font-bold mb-8">
                <span className="text-gray-900">Table of </span>
                <span className="text-[#39FF14]">Contents</span>
              </h2>

              {/* TOC Items */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <span className="text-[#39FF14] mr-2">●</span>
                  <span className="text-[#39FF14] font-bold mr-2">1.</span>
                  <span className="font-semibold text-gray-900">Introduction</span>
                  <span className="flex-1 mx-4 border-b border-dotted border-gray-300" />
                  <span className="text-gray-500">3</span>
                </div>

                <div className="flex items-center pl-6">
                  <span className="text-gray-400 mr-2">●</span>
                  <span className="text-[#39FF14] font-bold mr-2">1.1</span>
                  <span className="text-gray-900">Purpose of this Document</span>
                  <span className="flex-1 mx-4 border-b border-dotted border-gray-300" />
                  <span className="text-gray-500">3</span>
                </div>

                <div className="flex items-center pl-6">
                  <span className="text-gray-400 mr-2">●</span>
                  <span className="text-[#39FF14] font-bold mr-2">1.2</span>
                  <span className="text-gray-900">Target Audience</span>
                  <span className="flex-1 mx-4 border-b border-dotted border-gray-300" />
                  <span className="text-gray-500">3</span>
                </div>

                <div className="border-t border-gray-200 my-4" />

                <div className="flex items-center">
                  <span className="text-[#39FF14] mr-2">●</span>
                  <span className="text-[#39FF14] font-bold mr-2">2.</span>
                  <span className="font-semibold text-gray-900">The Classification Challenge</span>
                  <span className="flex-1 mx-4 border-b border-dotted border-gray-300" />
                  <span className="text-gray-500">4</span>
                </div>

                <div className="flex items-center pl-6">
                  <span className="text-gray-400 mr-2">●</span>
                  <span className="text-[#39FF14] font-bold mr-2">2.1</span>
                  <span className="text-gray-900">Data Volume & Complexity</span>
                  <span className="flex-1 mx-4 border-b border-dotted border-gray-300" />
                  <span className="text-gray-500">4</span>
                </div>

                <div className="border-t border-gray-200 my-4" />

                <div className="flex items-center">
                  <span className="text-[#39FF14] mr-2">●</span>
                  <span className="text-[#39FF14] font-bold mr-2">3.</span>
                  <span className="font-semibold text-gray-900">The Sentra Solution</span>
                  <span className="flex-1 mx-4 border-b border-dotted border-gray-300" />
                  <span className="text-gray-500">5</span>
                </div>
              </div>

              {/* Footer */}
              <div className="absolute bottom-8 left-8 right-8 flex justify-between text-xs text-gray-400">
                <span>© 2025 Sentra Inc. All rights reserved.</span>
                <span className="text-[#39FF14]">www.sentra.io</span>
              </div>
            </div>
          </TabsContent>

          {/* Content Page Preview */}
          <TabsContent value="content" className="mt-4">
            <div className="bg-white rounded-lg shadow-lg p-8 min-h-[600px] relative border">
              {/* Header */}
              <div className="flex items-center border-b-2 border-[#39FF14] pb-2 mb-8">
                <span className="font-bold text-gray-900">sentra</span>
                <span className="text-gray-500 ml-2">| WHITEPAPER</span>
              </div>

              {/* Section Heading */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#39FF14] mb-2">
                  <span>1. </span>
                  <span>Introduction</span>
                </h2>
                <div className="w-48 h-0.5 bg-[#39FF14]" />
              </div>

              {/* Content */}
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  In today's data-driven enterprise landscape, the volume of sensitive information 
                  continues to grow exponentially. Organizations face unprecedented challenges in 
                  identifying, classifying, and protecting their most valuable data assets.
                </p>
                <p>
                  Traditional classification methods rely heavily on manual processes and rigid 
                  rule-based systems. These approaches often fail to keep pace with the dynamic 
                  nature of modern data environments.
                </p>
              </div>

              {/* Subsection */}
              <div className="mt-8 mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  <span className="text-[#39FF14] mr-2">1.1</span>
                  Purpose of this Document
                </h3>
              </div>

              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  This whitepaper explores how Sentra's AI-powered classification engine 
                  revolutionizes data security by automatically discovering and classifying 
                  sensitive information across cloud environments.
                </p>
              </div>

              {/* Footer */}
              <div className="absolute bottom-8 left-8 right-8 flex justify-between text-xs text-gray-400">
                <span>© 2025 Sentra Inc. All rights reserved.</span>
                <span className="text-[#39FF14]">www.sentra.io</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TemplatePreview;

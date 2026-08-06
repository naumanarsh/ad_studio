"use client";

import { useState, type ReactNode } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export type Section = {
  value: string;
  label: string;
  count?: number;
  title: ReactNode;
  description: string;
};

/** Page-level sub-tabs whose heading follows the active section. */
export function SectionTabs({
  kicker,
  sections,
  contents,
  defaultValue,
}: {
  kicker: string;
  sections: Section[];
  contents: Record<string, ReactNode>;
  defaultValue?: string;
}) {
  const [active, setActive] = useState(
    defaultValue ?? sections[0]?.value ?? "",
  );
  const current = sections.find((s) => s.value === active) ?? sections[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="kicker">{kicker}</p>
        <h1 className="display mt-2">{current?.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {current?.description}
        </p>
      </div>

      <Tabs value={active} onValueChange={setActive} className="gap-6">
        <TabsList>
          {sections.map((section) => (
            <TabsTrigger key={section.value} value={section.value}>
              {section.label}
              {section.count !== undefined && ` · ${section.count}`}
            </TabsTrigger>
          ))}
        </TabsList>
        {sections.map((section) => (
          <TabsContent key={section.value} value={section.value}>
            {contents[section.value]}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

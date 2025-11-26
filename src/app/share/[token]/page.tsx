"use client";

import { useParams } from "next/navigation";
import { MappingSheetEditor } from "@/components/projects/mapping/MappingSheetEditor";

export default function PublicFormPage() {
  const params = useParams();
  const token = params?.token as string;

  if (!token) {
    return null;
  }

  return (
    <MappingSheetEditor
      dataSource={{ type: "token", token }}
      variant="standalone"
    />
  );
}

"use client";

import { setUserPerson } from "../user-actions";
import { FormSelect } from "@/components/ui/FormSelect";

export type PersonOption = { id: string; display_name: string };

export function UserPersonCell({
  email,
  personId,
  people,
}: {
  email: string;
  personId: string | null;
  people: PersonOption[];
}) {
  return (
    <FormSelect
      defaultValue={personId ?? ""}
      placeholder="Sin vincular"
      options={[
        { value: "", label: "Sin vincular" },
        ...people.map((person) => ({
          value: person.id,
          label: person.display_name,
        })),
      ]}
      onChange={(next) => {
        void setUserPerson(email, next || null);
      }}
    />
  );
}

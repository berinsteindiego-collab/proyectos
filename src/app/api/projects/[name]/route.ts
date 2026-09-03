import { NextRequest, NextResponse } from "next/server";
import { getProjectStatus } from "@/lib/airtable/projects";
import { AirtableError } from "@/lib/airtable/client";
import { AmbiguousProjectError, ProjectNotFoundError } from "@/lib/project-status/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { name: string } }
) {
  const projectName = decodeURIComponent(params.name);

  try {
    const status = await getProjectStatus(projectName);
    return NextResponse.json(status);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof AmbiguousProjectError) {
      return NextResponse.json(
        { error: err.message, matches: err.matches },
        { status: 409 }
      );
    }
    if (err instanceof AirtableError) {
      // Never leak internal error detail that could hint at credentials.
      return NextResponse.json(
        { error: "Could not read Airtable." },
        { status: err.status === 0 ? 502 : 500 }
      );
    }
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

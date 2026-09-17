import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function runQC(
  title: string,
  season: number,
  episode: number,
  market: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(
      process.cwd(),
      "disney-qc-poc",
      "scripts",
      "qc.mjs"
    );

    const child = spawn(
      process.execPath,
      [
        scriptPath,
        title,
        String(season),
        String(episode),
        market,
      ],
      {
        cwd: process.cwd(),
        windowsHide: true,
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr || stdout || `QC finalizó con código ${code}`
          )
        );
        return;
      }

      resolve(stdout);
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const title = String(body.title || "").trim();
    const season = Number(body.season);
    const episode = Number(body.episode);
    const market = String(body.market || "ARG").toUpperCase();

    if (!title || !season || !episode) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faltan título, temporada o episodio.",
        },
        { status: 400 }
      );
    }

    const output = await runQC(title, season, episode, market);

    return NextResponse.json({
      ok: true,
      title,
      season,
      episode,
      market,
      output,
    });
  } catch (error) {
    console.error("QC API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo ejecutar el QC.",
      },
      { status: 500 }
    );
  }
}
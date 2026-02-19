import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const { query, limit, numCandidates } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Create a temporary file for the full JSON output
    tempFilePath = path.join(os.tmpdir(), `eureka-update-me-${Date.now()}.json`);

    // Path to the Eureka Python CLI
    const eurekaPath = path.join(process.cwd(), '..', 'Eureka');
    const pythonScript = path.join(eurekaPath, 'eureka_cli.py');

    // Build command arguments for update-me with full output
    const args = ['update-me', query];
    if (limit) args.push('--limit', String(limit));
    if (numCandidates) args.push('--candidates', String(numCandidates));
    args.push('--save', tempFilePath); // Save full JSON output

    // Execute the Python script
    await executePythonScript(pythonScript, args, eurekaPath);

    // Read the results from the temporary file
    const resultsJson = fs.readFileSync(tempFilePath, 'utf-8');
    const results = JSON.parse(resultsJson);

    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    tempFilePath = null;

    return NextResponse.json({
      success: true,
      query: results.query,
      digest: results.digest,
      papers: results.papers,
      clarifications: results.clarifications,
      metadata: {
        ...results.metadata,
        limit: limit || 12,
        numCandidates: numCandidates || 40,
        mode: 'update'
      },
    });
  } catch (error: any) {
    console.error('Eureka Update Me Full API error:', error);
    
    // Clean up temp file if it exists
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    return NextResponse.json(
      { 
        error: 'Failed to process Eureka Update Me query',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Execute Python script and return output
 */
function executePythonScript(
  scriptPath: string,
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Use python3 from Eureka's venv
    const pythonPath = path.join(cwd, '..', '.venv', 'bin', 'python3');
    
    const pythonProcess = spawn(pythonPath, [scriptPath, ...args], {
      cwd,
      env: {
        ...process.env,
        PYTHONPATH: cwd,
        // Pass required environment variables to Python subprocess
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        MONGODB_URI: process.env.MONGODB_URI || '',
        MONGODB_DATABASE: process.env.MONGODB_DATABASE || 'verge_neuro_lit_topics',
        MONGODB_COLLECTION: process.env.MONGODB_COLLECTION || 'papers_clean',
        VECTOR_INDEX_NAME: process.env.VECTOR_INDEX_NAME || 'vector_index',
        VECTOR_DIMENSIONS: process.env.VECTOR_DIMENSIONS || '1536',
        VECTOR_MODEL: process.env.VECTOR_MODEL || 'text-embedding-3-small',
        GPT_MODEL: process.env.GPT_MODEL || 'gpt-5-nano',
        DEFAULT_NUM_CANDIDATES: '40',  // Update Me default
        DEFAULT_LIMIT: '12',  // Update Me default
        TEMPERATURE: '0.1',
      },
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    pythonProcess.on('error', (error: Error) => {
      reject(error);
    });

    // Set timeout (150 seconds for update me mode - uses LLM presenter with optimized abstracts)
    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error('Python process timed out after 150 seconds'));
    }, 150000);
  });
}


import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function POST(request: NextRequest) {
  let tempFile: string | null = null;
  
  try {
    const { query, limit, numCandidates } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Create temporary file for JSON output
    tempFile = path.join(os.tmpdir(), `eureka-${Date.now()}.json`);

    // Path to the Eureka Python CLI
    const eurekaPath = path.join(process.cwd(), '..', 'Eureka');
    const pythonScript = path.join(eurekaPath, 'eureka_cli.py');

    // Build command arguments
    const args = ['search', query];
    if (limit) args.push('--limit', String(limit));
    if (numCandidates) args.push('--candidates', String(numCandidates));
    args.push('--save', tempFile); // Save full results to JSON

    // Execute the Python script
    await executePythonScript(pythonScript, args, eurekaPath);

    // Read the JSON result
    const resultData = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));

    // Clean up temp file
    fs.unlinkSync(tempFile);
    tempFile = null;

    return NextResponse.json({
      success: true,
      ...resultData,
    });
  } catch (error: any) {
    console.error('Eureka API error:', error);
    
    // Clean up temp file on error
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to process Eureka query',
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
    
    const childProcess = spawn(pythonPath, [scriptPath, ...args], {
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
        GPT_MODEL: process.env.GPT_MODEL || 'gpt-5-nano',  // Keep gpt-5-nano as required
        DEFAULT_NUM_CANDIDATES: '50',  // Reduced for speed (default 100)
        DEFAULT_LIMIT: '3',  // Reduced for speed (default 6)
        TEMPERATURE: '0.1',
      },
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    childProcess.on('error', (error: Error) => {
      reject(error);
    });

    // Set timeout (2 minutes for complex queries)
    setTimeout(() => {
      childProcess.kill();
      reject(new Error('Python process timed out after 2 minutes'));
    }, 120000);
  });
}


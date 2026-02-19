import { PrismaClient } from '@prisma/client';
import axios, { AxiosResponse } from 'axios';

const prisma = new PrismaClient();

export interface CitationUpdateResult {
  staffPostId: number;
  oldCitationCount: number;
  newCitationCount: number;
  citationDelta: number;
  success: boolean;
  errorMessage?: string;
  processingTimeMs: number;
}

export interface OpenAlexWork {
  id: string;
  cited_by_count: number;
  updated_date: string;
}

export interface OpenAlexResponse {
  results: OpenAlexWork[];
  meta: {
    count: number;
    next_cursor?: string;
  };
}

export class CitationUpdateSpider {
  private baseUrl = 'https://api.openalex.org';
  private rateLimitDelay = 50; // 50ms between requests (20 req/sec)
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor() {
    // Set up axios defaults
    axios.defaults.headers.common['User-Agent'] = 'verge-citation-updater/1.0';
    axios.defaults.headers.common['Accept'] = 'application/json';
    axios.defaults.timeout = 30000; // 30 second timeout
  }

  /**
   * Update citation count for a single paper
   */
  async updateSingleCitation(staffPostId: number): Promise<CitationUpdateResult> {
    const startTime = Date.now();

    try {
      // Get paper metadata
      const metadata = await (prisma as any).citationUpdateMetadata.findUnique({
        where: { staffPostId },
        include: {
          staffPost: true
        }
      });

      if (!metadata) {
        return {
          staffPostId,
          oldCitationCount: 0,
          newCitationCount: 0,
          citationDelta: 0,
          success: false,
          errorMessage: 'No metadata found for paper',
          processingTimeMs: Date.now() - startTime
        };
      }

      // Extract OpenAlex ID from linkId
      const openAlexId = this.extractOpenAlexId(metadata.staffPost.linkId);
      if (!openAlexId) {
        return {
          staffPostId,
          oldCitationCount: metadata.citationCount,
          newCitationCount: metadata.citationCount,
          citationDelta: 0,
          success: false,
          errorMessage: 'Invalid OpenAlex ID',
          processingTimeMs: Date.now() - startTime
        };
      }

      // Fetch current citation count from OpenAlex
      const newCitationCount = await this.fetchCitationCount(openAlexId);

      if (newCitationCount === null) {
        return {
          staffPostId,
          oldCitationCount: metadata.citationCount,
          newCitationCount: metadata.citationCount,
          citationDelta: 0,
          success: false,
          errorMessage: 'Failed to fetch citation count from OpenAlex',
          processingTimeMs: Date.now() - startTime
        };
      }

      const oldCitationCount = metadata.citationCount;
      const citationDelta = newCitationCount - oldCitationCount;

      // Update metadata
      await this.updateCitationMetadata(staffPostId, newCitationCount, oldCitationCount);

      // Log update history
      await this.logCitationUpdate(staffPostId, oldCitationCount, newCitationCount, citationDelta, 'scheduled');

      return {
        staffPostId,
        oldCitationCount,
        newCitationCount,
        citationDelta,
        success: true,
        processingTimeMs: Date.now() - startTime
      };

    } catch (error) {
      return {
        staffPostId,
        oldCitationCount: 0,
        newCitationCount: 0,
        citationDelta: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Update citations for multiple papers in batch
   */
  async updateBatchCitations(staffPostIds: number[]): Promise<CitationUpdateResult[]> {
    const results: CitationUpdateResult[] = [];

    for (const staffPostId of staffPostIds) {
      try {
        const result = await this.updateSingleCitation(staffPostId);
        results.push(result);

        // Rate limiting
        await this.delay(this.rateLimitDelay);

      } catch (error) {
        results.push({
          staffPostId,
          oldCitationCount: 0,
          newCitationCount: 0,
          citationDelta: 0,
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          processingTimeMs: 0
        });
      }
    }

    return results;
  }

  /**
   * Fetch citation count from OpenAlex API
   */
  private async fetchCitationCount(openAlexId: string): Promise<number | null> {
    const url = `${this.baseUrl}/works/${openAlexId}`;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response: AxiosResponse<OpenAlexWork> = await axios.get(url, {
          params: {
            mailto: 'benmonahan@gmail.com' // Polite pool access
          }
        });

        if (response.status === 200 && response.data) {
          return response.data.cited_by_count || 0;
        }

      } catch (error: any) {
        if (error.response?.status === 429) {
          // Rate limited - wait longer
          await this.delay(this.retryDelay * attempt);
          continue;
        }

        if (error.response?.status === 404) {
          // Paper not found
          return null;
        }

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Extract OpenAlex ID from linkId
   */
  private extractOpenAlexId(linkId: string): string | null {
    if (!linkId) return null;

    // Handle different formats
    if (linkId.startsWith('openalex:')) {
      return linkId.replace('openalex:', '');
    }

    if (linkId.includes('openalex.org')) {
      const match = linkId.match(/openalex\.org\/([A-Z]\d+)/);
      return match ? match[1] : null;
    }

    // Assume it's already an OpenAlex ID
    if (linkId.match(/^[A-Z]\d+$/)) {
      return linkId;
    }

    return null;
  }

  /**
   * Update citation metadata in database
   */
  private async updateCitationMetadata(
    staffPostId: number,
    newCitationCount: number,
    oldCitationCount: number
  ): Promise<void> {
    const now = new Date();
    const daysSinceLastUpdate = await this.calculateDaysSinceLastUpdate(staffPostId);

    // Calculate citation velocity
    const citationVelocity = daysSinceLastUpdate > 0
      ? (newCitationCount - oldCitationCount) / daysSinceLastUpdate
      : 0;

    // Update metadata
    await (prisma as any).citationUpdateMetadata.update({
      where: { staffPostId },
      data: {
        citationCount: newCitationCount,
        lastCitationCount: oldCitationCount,
        citationVelocity,
        lastVelocityCalculation: now,
        lastUpdateTimestamp: now,
        updatedAt: now
      }
    });

    // Update StaffPost citation count
    await (prisma as any).staffPost.update({
      where: { id: staffPostId },
      data: {
        citedByCount: newCitationCount
      }
    });

    // NEW: Sync to MongoDB pipeline and update relevance scores
    await this.syncCitationToPipeline(staffPostId, newCitationCount, oldCitationCount);
  }

  /**
   * NEW: Sync citation update to MongoDB pipeline and update relevance scores
   */
  private async syncCitationToPipeline(
    staffPostId: number,
    newCitationCount: number,
    oldCitationCount: number
  ): Promise<void> {
    try {
      // Get the staff post to find the corresponding MongoDB document
      const staffPost = await (prisma as any).staffPost.findUnique({
        where: { id: staffPostId },
        select: { linkId: true, title: true }
      });

      if (!staffPost) {
        console.log(`Staff post ${staffPostId} not found for MongoDB sync`);
        return;
      }

      // Extract OpenAlex ID from linkId
      const openAlexId = this.extractOpenAlexId(staffPost.linkId);
      if (!openAlexId) {
        console.log(`Invalid OpenAlex ID for staff post ${staffPostId}`);
        return;
      }

      // Construct the MongoDB document ID
      const mongoDocId = `openalex:${openAlexId}`;

      // Update MongoDB pipeline
      await this.updateMongoDBCitation(mongoDocId, newCitationCount);

      // Update relevance scores if citation change is significant
      if (Math.abs(newCitationCount - oldCitationCount) >= 1) {
        await this.updateRelevanceScores();
      }

      console.log(` Synced citation update to MongoDB: ${staffPost.title} (${oldCitationCount} → ${newCitationCount})`);

    } catch (error) {
      console.error(`Error syncing citation to MongoDB for staff post ${staffPostId}:`, error);
    }
  }

  /**
   * NEW: Update citation count in MongoDB pipeline
   */
  private async updateMongoDBCitation(mongoDocId: string, newCitationCount: number): Promise<void> {
    try {
      // Import MongoDB client dynamically to avoid circular dependencies
      const { MongoClient } = await import('mongodb');

      const mongoUri = process.env.MONGO_URI || "mongodb+srv://vergesciences:4Z60L2dbCGZQzEsD@cluster07302004.9bzldqa.mongodb.net/verge_neuro_lit?retryWrites=true&w=majority&appName=Cluster07302004";
      const client = new MongoClient(mongoUri);

      await client.connect();
      const db = client.db("verge_neuro_lit");
      const collection = db.collection("papers_clean");

      // Update the citation count
      const result = await collection.updateOne(
        { "_id": mongoDocId as any },
        {
          "$set": {
            "cited_by_count": newCitationCount,
            "updated_at": new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        console.log(`MongoDB document not found: ${mongoDocId}`);
      } else if (result.modifiedCount > 0) {
        console.log(`Updated MongoDB citation count: ${mongoDocId} → ${newCitationCount}`);
      }

      await client.close();

    } catch (error) {
      console.error('Error updating MongoDB citation:', error);
    }
  }

  /**
   * NEW: Update relevance scores in MongoDB pipeline
   */
  private async updateRelevanceScores(): Promise<void> {
    try {
      // Import MongoDB client dynamically
      const { MongoClient } = await import('mongodb');

      const mongoUri = process.env.MONGO_URI || "mongodb+srv://vergesciences:4Z60L2dbCGZQzEsD@cluster07302004.9bzldqa.mongodb.net/verge_neuro_lit?retryWrites=true&w=majority&appName=Cluster07302004";
      const client = new MongoClient(mongoUri);

      await client.connect();
      const db = client.db("verge_neuro_lit");
      const collection = db.collection("papers_clean");

      // Load ranking configuration
      let alpha = 0.4;
      let beta = 0.6;

      try {
        // Try to read config from the pipeline directory
        const fs = await import('fs');
        const path = await import('path');
        const configPath = path.join(process.cwd(), '..', 'abstract-pipeline', 'config.json');

        if (fs.existsSync(configPath)) {
          const configData = fs.readFileSync(configPath, 'utf8');
          const config = JSON.parse(configData);
          const rankingConfig = config.ranking_algorithm || { "alpha": 0.4, "beta": 0.6 };
          alpha = rankingConfig.alpha || 0.4;
          beta = rankingConfig.beta || 0.6;
        }
      } catch (error) {
        console.log('Using default ranking parameters (alpha=0.4, beta=0.6)');
      }

      // Calculate global statistics
      const globalStats = await collection.aggregate([
        {
          "$group": {
            "_id": null,
            "max_citations": { "$max": "$cited_by_count" },
            "min_pub_date": { "$min": { "$dateFromString": { "dateString": "$publication_date" } } }
          }
        }
      ]).toArray();

      if (globalStats.length === 0) {
        console.log('No papers found for relevance score update');
        await client.close();
        return;
      }

      const globalMaxCitations = globalStats[0].max_citations || 1;
      const oldestDate = globalStats[0].min_pub_date;
      const globalMaxDaysSincePub = oldestDate ?
        Math.max(1, (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) :
        365 * 10;

      console.log(`Updating relevance scores with global max citations: ${globalMaxCitations}`);

      // Get all papers and update relevance scores in batches
      const cursor = collection.find({});
      let batchCount = 0;
      const batchSize = 100;

      while (await cursor.hasNext()) {
        const batch = await cursor.next();
        if (!batch) continue;

        // Calculate relevance score for this paper
        const publicationDate = new Date(batch.publication_date);
        const daysSincePub = Math.max(0, (Date.now() - publicationDate.getTime()) / (1000 * 60 * 60 * 24));

        const Rnorm = globalMaxDaysSincePub > 0 ? daysSincePub / globalMaxDaysSincePub : 0;
        const Cnorm = globalMaxCitations > 0 ? (batch.cited_by_count || 0) / globalMaxCitations : 0;

        const relevanceScore = (1 - alpha * Rnorm) + (beta * Cnorm);

        // Update the paper with new relevance score
        await collection.updateOne(
          { "_id": batch._id as any },
          {
            "$set": {
              "relevance_score": Math.max(0, Math.min(1, relevanceScore)),
              "updated_at": new Date()
            }
          }
        );

        batchCount++;
        if (batchCount % batchSize === 0) {
          console.log(`Processed ${batchCount} papers for relevance score update`);
        }
      }

      console.log(` Relevance scores updated successfully for ${batchCount} papers`);

      await client.close();

    } catch (error) {
      console.error('Error updating relevance scores:', error);
    }
  }

  /**
   * Log citation update to history
   */
  private async logCitationUpdate(
    staffPostId: number,
    oldCitationCount: number,
    newCitationCount: number,
    citationDelta: number,
    updateTrigger: string
  ): Promise<void> {
    await (prisma as any).citationUpdateHistory.create({
      data: {
        staffPostId,
        oldCitationCount,
        newCitationCount,
        citationDelta,
        velocityCalculated: citationDelta > 0 ? citationDelta : 0,
        updateTrigger,
        success: true,
        createdAt: new Date()
      }
    });
  }

  /**
   * Calculate days since last update
   */
  private async calculateDaysSinceLastUpdate(staffPostId: number): Promise<number> {
    const metadata = await (prisma as any).citationUpdateMetadata.findUnique({
      where: { staffPostId },
      select: { lastUpdateTimestamp: true }
    });

    if (!metadata?.lastUpdateTimestamp) {
      return 1; // Default to 1 day if no previous update
    }

    const now = new Date();
    const lastUpdate = new Date(metadata.lastUpdateTimestamp);
    const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(diffDays, 1); // Minimum 1 day
  }

  /**
   * Get papers that need citation updates
   */
  async getPapersNeedingUpdate(limit: number = 50): Promise<number[]> {
    const now = new Date();

    const papers = await (prisma as any).citationUpdateMetadata.findMany({
      where: {
        nextScheduledUpdate: {
          lte: now
        }
      },
      orderBy: [
        { priorityScore: 'desc' },
        { nextScheduledUpdate: 'asc' }
      ],
      select: {
        staffPostId: true
      },
      take: limit
    });

    return papers.map((p: any) => p.staffPostId);
  }

  /**
   * Process citation update queue
   */
  async processUpdateQueue(batchSize: number = 20): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: CitationUpdateResult[];
  }> {
    const papersToUpdate = await this.getPapersNeedingUpdate(batchSize);

    if (papersToUpdate.length === 0) {
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        results: []
      };
    }

    console.log(`Processing ${papersToUpdate.length} papers for citation updates...`);

    const results = await this.updateBatchCitations(papersToUpdate);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Citation update complete: ${successful} successful, ${failed} failed`);

    return {
      processed: papersToUpdate.length,
      successful,
      failed,
      results
    };
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await prisma.$disconnect();
  }

  /**
   * PUBLIC: Manually trigger relevance score updates (for testing and manual operations)
   */
  async triggerRelevanceScoreUpdate(): Promise<{ success: boolean; message: string; papersUpdated?: number }> {
    try {
      console.log(' Manually triggering relevance score update...');

      // Import MongoDB client dynamically
      const { MongoClient } = await import('mongodb');

      const mongoUri = process.env.MONGO_URI || "mongodb+srv://vergesciences:4Z60L2dbCGZQzEsD@cluster07302004.9bzldqa.mongodb.net/verge_neuro_lit?retryWrites=true&w=majority&appName=Cluster07302004";
      const client = new MongoClient(mongoUri);

      await client.connect();
      const db = client.db("verge_neuro_lit");
      const collection = db.collection("papers_clean");

      // Count papers before update
      const totalPapers = await collection.countDocuments();
      console.log(` Total papers in database: ${totalPapers}`);

      // Call the private update method
      await this.updateRelevanceScores();

      await client.close();

      return {
        success: true,
        message: `Relevance scores updated successfully for ${totalPapers} papers`,
        papersUpdated: totalPapers
      };

    } catch (error) {
      console.error('Error in manual relevance score update:', error);
      return {
        success: false,
        message: `Failed to update relevance scores: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const citationUpdateSpider = new CitationUpdateSpider(); 
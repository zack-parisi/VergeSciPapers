import { NextRequest, NextResponse } from "next/server";
import { checkMongoDBHealth, getUsersCollection, getPapersStagingCollection, getPapersCleanCollection, getGrantsCleanCollection } from "../../../../lib/mongodb-user-interactions";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(' Starting MongoDB health check...');
    
    // Check basic connection health
    const healthCheck = await checkMongoDBHealth();
    
    // Test critical collections for staff posts and grants
    let criticalCollectionsTest: any = { status: 'unknown', duration: 0 };
    if (healthCheck.status === 'healthy') {
      const operationStart = Date.now();
      try {
        console.log(' Testing critical collections for staff posts and grants...');
        
        // Test papers_clean collection (staff posts)
        const papersCleanCollection = await getPapersCleanCollection();
        const papersCount = await papersCleanCollection.countDocuments({}, { limit: 1000 });
        
        // Test grants_clean collection (grants)
        const grantsCleanCollection = await getGrantsCleanCollection();
        const grantsCount = await grantsCleanCollection.countDocuments({}, { limit: 1000 });
        
        const operationDuration = Date.now() - operationStart;
        
        criticalCollectionsTest = {
          status: 'success',
          duration: operationDuration,
          papers_clean: {
            accessible: true,
            sampleCount: papersCount
          },
          grants_clean: {
            accessible: true,
            sampleCount: grantsCount
          }
        };
        
        console.log(` Critical collections test successful - Papers: ${papersCount}, Grants: ${grantsCount}`);
        
      } catch (error: any) {
        criticalCollectionsTest = {
          status: 'failed',
          duration: Date.now() - operationStart,
          error: error.message,
          papers_clean: { accessible: false },
          grants_clean: { accessible: false }
        };
        console.error(' Critical collections test failed:', error.message);
      }
    }
    
    // Test a simple database operation
    let dbOperationTest: any = { status: 'unknown', duration: 0 };
    if (healthCheck.status === 'healthy') {
      const operationStart = Date.now();
      try {
        const usersCollection = await getUsersCollection();
        const userCount = await usersCollection.countDocuments({});
        const operationDuration = Date.now() - operationStart;
        
        dbOperationTest = {
          status: 'success',
          duration: operationDuration,
          userCount
        };
      } catch (error: any) {
        dbOperationTest = {
          status: 'failed',
          duration: Date.now() - operationStart,
          error: error.message
        };
      }
    }
    
    const totalDuration = Date.now() - startTime;
    
    const healthStatus = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        MONGO_URI_EXISTS: !!process.env.MONGO_URI,
      },
      connection: healthCheck,
      criticalCollections: criticalCollectionsTest,
      databaseOperation: dbOperationTest,
      performance: {
        totalDuration,
        status: healthCheck.status === 'healthy' && 
                dbOperationTest.status === 'success' && 
                criticalCollectionsTest.status === 'success' ? 'healthy' : 'degraded'
      }
    };
    
    console.log(' MongoDB health check completed:', healthStatus);
    
    return NextResponse.json(healthStatus);
    
  } catch (error: any) {
    console.error(' MongoDB health check failed:', error);
    
    const errorStatus = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        MONGO_URI_EXISTS: !!process.env.MONGO_URI,
      },
      connection: {
        status: 'unhealthy',
        message: 'Health check failed',
        error: error.message
      },
      criticalCollections: {
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message,
        papers_clean: { accessible: false },
        grants_clean: { accessible: false }
      },
      databaseOperation: {
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message
      },
      performance: {
        totalDuration: Date.now() - startTime,
        status: 'unhealthy'
      }
    };
    
    return NextResponse.json(errorStatus, { status: 500 });
  }
} 
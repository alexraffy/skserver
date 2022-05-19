

import {SKSQL, SQLStatement, TAuthSession, TDBEventsDelegate} from "sksql";


export function updateWorkerStatus(worker_id: number, status: "SPAWN" | "RUNNING" | "DOWN"): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        let db2 = new SKSQL();
        db2.remoteModeOnly = true;

        let delegate: TDBEventsDelegate = {
            on(db: SKSQL, databaseHashId: string, message: string, payload: any) {
            },
            connectionLost(db: SKSQL, databaseHashId: string) {
            },
            connectionError(db: SKSQL, databaseHashId: string, error: string): any {
                resolve(false);
            },
            ready(db: SKSQL, databaseHashId: string): any {
                let st = new SQLStatement(db, "Exec usp_heartbeatWorker @worker_id = @worker_id, @status = @status;");
                st.setParameter("@worker_id", worker_id);
                st.setParameter("@status", status);
                st.run();
                st.close();
                db2.disconnect(databaseHashId);
                resolve(true);
            },
            authRequired(db: SKSQL, databaseHashId: string): TAuthSession {
                return {name: "SKDirector", token: "", valid: true};
            }
        }
        db2.connectToDatabase(process.env.SKWORKER_HEARTBEAT, delegate)
    });


}
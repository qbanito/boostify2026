import { db } from '../firebase';
import { logger } from "./logger";
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const auth = getAuth();

// Contract types definition
export type ContractType = 'legal' | 'recording' | 'performance' | 'licensing' | 'distribution' | 'publishing' | 'management' | 'analysis';

// Contract interface
export interface Contract {
  id?: string;
  title: string;
  content: string;
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
  updatedAt?: Date;
  userId: string;
  parties?: string[];
  type?: ContractType;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Save a new contract to Firestore
 * @param contract Contract data to save
 * @returns Promise with the saved contract ID
 */
export async function saveContract(contract: Omit<Contract, 'id'>): Promise<string> {
  try {
    // Ensure current user exists
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const contractData = {
      ...contract,
      userId: user.uid,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const contractsCollection = collection(db, 'contracts');
    const docRef = await addDoc(contractsCollection, contractData);
    
    return docRef.id;
  } catch (error) {
    logger.error('Error saving contract:', error);
    throw error;
  }
}

/**
 * Get all contracts for the current user
 * @returns Promise with array of contracts
 */
export async function getUserContracts(): Promise<Contract[]> {
  try {
    // Ensure current user exists
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const contractsCollection = collection(db, 'contracts');
    const q = query(contractsCollection, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Convert Firestore Timestamps to Date objects
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt;
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt;
      const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : data.expiresAt;
      
      return {
        id: doc.id,
        ...data,
        createdAt,
        updatedAt,
        expiresAt
      } as Contract;
    });
  } catch (error) {
    logger.error('Error getting user contracts:', error);
    throw error;
  }
}

/**
 * Update an existing contract
 * @param contractId ID of the contract to update
 * @param updates Contract updates
 * @returns Promise that resolves when the update is complete
 */
export async function updateContract(contractId: string, updates: Partial<Contract>): Promise<void> {
  try {
    // Ensure current user exists
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get the contract first to verify ownership
    const contractRef = doc(db, 'contracts', contractId);
    const contractSnap = await getDoc(contractRef);
    
    if (!contractSnap.exists()) {
      throw new Error('Contract not found');
    }
    
    const contractData = contractSnap.data();
    if (contractData.userId !== user.uid) {
      throw new Error('You do not have permission to update this contract');
    }
    
    await updateDoc(contractRef, {
      ...updates,
      updatedAt: new Date()
    });
  } catch (error) {
    logger.error('Error updating contract:', error);
    throw error;
  }
}

/**
 * Delete a contract
 * @param contractId ID of the contract to delete
 * @returns Promise that resolves when the deletion is complete
 */
export async function deleteContract(contractId: string): Promise<void> {
  try {
    // Ensure current user exists
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Get the contract first to verify ownership
    const contractRef = doc(db, 'contracts', contractId);
    const contractSnap = await getDoc(contractRef);
    
    if (!contractSnap.exists()) {
      throw new Error('Contract not found');
    }
    
    const contractData = contractSnap.data();
    if (contractData.userId !== user.uid) {
      throw new Error('You do not have permission to delete this contract');
    }
    
    await deleteDoc(contractRef);
  } catch (error) {
    logger.error('Error deleting contract:', error);
    throw error;
  }
}
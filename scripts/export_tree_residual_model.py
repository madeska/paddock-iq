"""Export the pinned sklearn numerical histogram trees; leaf values include shrinkage."""
import math

def export_tree_residual_model(model, season, before_round):
 import sklearn
 from sklearn.ensemble import HistGradientBoostingRegressor
 if sklearn.__version__!='1.7.2' or model.n_features_in_!=10: raise ValueError('Unexpected sklearn model version or features')
 expected=dict(loss='squared_error',learning_rate=.05,max_iter=60,max_leaf_nodes=4,min_samples_leaf=20,l2_regularization=10,early_stopping=False,random_state=42)
 if model.get_params()!=HistGradientBoostingRegressor(**expected).get_params(): raise ValueError('Frozen model parameters changed')
 if len(model._predictors)!=60: raise ValueError('Expected frozen 60-stage model')
 trees=[]
 for stage in model._predictors:
  if len(stage)!=1: raise ValueError('Only scalar regression supported')
  nodes=[]
  for node in stage[0].nodes:
   if node['is_categorical']: raise ValueError('Categorical splits not supported')
   if node['is_leaf']:
    value=float(node['value'])
    if not math.isfinite(value): raise ValueError('Invalid leaf value')
    nodes.append(dict(leaf=True,value=value))
   else:
    threshold=float(node['num_threshold'])
    if not math.isfinite(threshold): raise ValueError('Invalid numerical threshold')
    nodes.append(dict(leaf=False,feature=int(node['feature_idx']),threshold=threshold,left=int(node['left']),right=int(node['right'])))
  trees.append(nodes)
 return dict(schemaVersion=1,policy='driver-only-tree-half-v1',scikitLearn=sklearn.__version__,featureCount=10,season=season,beforeRound=before_round,baseValue=float(model._baseline_prediction[0,0]),trees=trees)
